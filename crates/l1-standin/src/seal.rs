//! ´mod:module:seal´
//!
//! Host side of the admission handshake's two relay legs
//! (layer1-interface.md §8.2). `seal` runs the act checks on a submission,
//! adds salts, forms the binding commitments, and seals the verified act;
//! `approve` verifies the approval witness over that exact verified act
//! and its seal. Ordering admits only a verified act carrying a valid
//! approval witness.
//!
//! The submission carries no content pair, and this host never asks for
//! one: every act check, both commitments and the seal are computed from
//! the body, the dependency list and nonce, the opaque content pre-digest,
//! the pre-commitment and the pre-signature (§8.2, "Verified act").

use common::l1::census::FamilyKind;
use common::l1::crypto;
use common::l1::handshake::{ApprovalWitness, approval_digest, is_canonical_dep_list};
use common::l1::identifier::{ActId, NodeId};
use common::l1::proposal::{
    CONTENT_EDITION, DEPENDENCY_EDITION, SealedAct, Submission, SubmissionError, VerifiedAct,
};
use rand::RngCore;
use rand::rngs::OsRng;

use crate::{StandIn, StandInError};

/// Bound on declared dependencies + asserted parents — the "dependency
/// bounds" of the verified-act definition (layer1-interface.md §8.2); a
/// stand-in operating value.
const MAX_DEPS: usize = 64;

fn formation(msg: impl Into<String>) -> StandInError {
    StandInError::Formation(msg.into())
}

/// Runs the act checks on a submission and seals it into a verified act
/// (layer1-interface.md §8.2, "Verified act"), enforcing:
///
/// - **Formation.** The act identifier is well-formed by construction of
///   the typed body; endpoint typing and the (p_d, p_i) tuple are
///   checked against the census.
/// - **Minted-endpoint rules** (layer1-interface.md §8.1). A self-minted
///   target is valid only for the genesis families; genesis identity is
///   per record, so an ordinary-role act toward an existing mint — a
///   Publish revising its Content node — is well-formed, and it is the
///   fold, never formation, that decides what it means. Foreign minted
///   references are permitted even when unanchored: dangling identifiers
///   are fold-neutral, never a formation failure. A founding Participant
///   self-loops at its own mint — both legs enter the Chat the act
///   creates — so the middle-node rule exempts exactly that shape.
/// - **Bid/T is fresh-mint-only** (layer1-interface.md §8.1): a Bid
///   toward an existing Offer would hang a second Item's incidence on
///   it — real raw incidence, live in CAN and sentiment even where no
///   fold reads it. Offer revision is a new Offer.
/// - **Dependency bounds**, checked against `MAX_DEPS`, and the list's own
///   form: no self-dependency, and strictly ascending under
///   [`common::l1::handshake::dependency_order`] — sorted and
///   duplicate-free (§8.2, "Act dependency projection"). The payload bound
///   is a carriage check and the content nonce's format, length,
///   freshness and non-reuse are carriage obligations, none of them a
///   condition of the act (§8.2, "Verified act" and "Proposal
///   pre-commitment"); with no pair here, they are the carrier's. The
///   dependency nonce has no rule of its own beyond being the bytes the
///   dependency pre-digest recomputes from.
/// - **Storable sequence.** The author-local sequence is a `u64` in the
///   identifier and a BIGINT in storage. A value above `i64::MAX` would
///   store as a negative beside an `act_id` text carrying the unsigned
///   one — the column and the identifier disagreeing about the same act —
///   so it is refused where the two meet rather than narrowing the
///   identifier grammar the clients share.
/// - **Authorship.** The stated author's key binds to the address, and
///   the pre-commitment recomputes from the body, the received content
///   pre-digest and the dependency pre-digest formed here, under a
///   pre-signature that verifies over it. Key consistency across the
///   author's history needs no separate check: the address derives from
///   the key, so this binding already pins it.
/// - **Host additions.** Fresh domain-separated salts meeting the
///   entropy floor, the content commitment over the content pre-digest,
///   the dependency commitment over the dependency list, and the host
///   seal over the header. The content pre-digest is not stored: the
///   header does not carry it and nothing after the seal reads it.
/// - **Persistence.** The insert is the uniqueness check — a second
///   record claiming the same act identifier, or reusing the
///   author-local sequence, is equivocation and produces no Layer-1
///   object. Sealed-but-never-approved rows are never collected:
///   unbounded, but stand-in-scoped, since the whole l1_* table set
///   drops at the swap, so a reaper here would only be machinery for
///   throwaway substrate state. The author's key is learned on first
///   contact (the account may pre-exist from a burn credit with no key
///   yet) in the same transaction as the act, so a crash cannot store an
///   act whose key was never learned.
pub(crate) async fn seal(
    standin: &StandIn,
    submission: Submission,
) -> Result<SealedAct, StandInError> {
    let body = &submission.body;
    let family = body.family;

    let act_id = ActId::new(&body.author, body.seq, family)
        .map_err(|e| formation(format!("act identifier: {e}")))?;
    family
        .endpoint_check(
            &body.author,
            &body.source(),
            body.middle.as_ref(),
            &body.target,
        )
        .map_err(formation)?;
    family.params_check(body.p_d, body.p_i).map_err(formation)?;

    let own_mint = NodeId::Mint(act_id.clone());
    let founding_participant = family == common::l1::Family::Participant && body.target == own_mint;
    if body.middle.as_ref() == Some(&own_mint) && !founding_participant {
        return Err(formation("the middle node cannot be minted by its own act"));
    }
    if body.target == own_mint && family.minted_node().is_none() {
        return Err(formation(format!(
            "{family} is not a genesis family and cannot mint its target"
        )));
    }
    if family == common::l1::Family::Bid && body.target != own_mint {
        return Err(formation(
            "bid mints its Offer: the terminal target must be the act's own mint",
        ));
    }

    if submission.deps.len() + body.asserted_parents.len() > MAX_DEPS {
        return Err(formation("dependency list exceeds the bound"));
    }
    if submission.deps.contains(&act_id) {
        return Err(formation(format!("{act_id} names itself as a dependency")));
    }
    if !is_canonical_dep_list(&submission.deps) {
        return Err(formation(
            "dependency list is not strictly ascending by act identifier",
        ));
    }
    if body.seq > i64::MAX as u64 {
        return Err(formation(format!(
            "author-local sequence {} exceeds the stored range",
            body.seq
        )));
    }

    let author_key = crypto::verifying_key_from_bytes(&submission.author_pubkey)
        .ok_or_else(|| StandInError::Authentication("malformed author public key".into()))?;
    if crypto::address_of(&author_key) != body.author {
        return Err(StandInError::Authentication(
            "author public key does not bind to the author address".into(),
        ));
    }

    let mut content_salt = vec![0u8; crypto::SALT_LEN];
    let mut deps_salt = vec![0u8; crypto::SALT_LEN];
    OsRng.fill_bytes(&mut content_salt);
    OsRng.fill_bytes(&mut deps_salt);
    let host_key = standin.host_key().await?;
    let sealed = submission
        .seal(&host_key, content_salt, deps_salt)
        .map_err(|e: SubmissionError| StandInError::Authentication(e.to_string()))?;
    let act = &sealed.act;

    let parents: Vec<String> = body
        .asserted_parents
        .iter()
        .map(|p| p.to_string())
        .collect();
    let deps: Vec<String> = submission.deps.iter().map(|d| d.to_string()).collect();
    let mut tx = standin.pool().begin().await?;
    let inserted = sqlx::query!(
        "INSERT INTO l1_acts (
            act_id, author, seq, family, author_pubkey, middle, target,
            p_d, p_i, settlement_ref, license, asserted_parents, deps,
            dependency_nonce, pre_signature, pre_commitment, content_salt,
            deps_salt, content_commitment, deps_commitment, host_seal, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'sealed')
         ON CONFLICT DO NOTHING",
        act_id.to_string(),
        body.author,
        body.seq as i64,
        family.as_str(),
        &submission.author_pubkey,
        body.middle.as_ref().map(|m| m.to_string()),
        body.target.to_string(),
        body.p_d,
        body.p_i,
        body.settlement_ref.as_ref().map(|r| r.to_string()),
        body.license,
        &parents,
        &deps,
        &submission.dependency_nonce,
        &act.pre_signature,
        &act.pre_commitment,
        &sealed.content_salt,
        &sealed.dependency_salt,
        &act.content_commitment,
        &act.dependency_commitment,
        &sealed.host_seal,
    )
    .execute(&mut *tx)
    .await?;
    if inserted.rows_affected() == 0 {
        return Err(StandInError::Conflict(format!(
            "act identifier {act_id} (or its author-local sequence) already exists"
        )));
    }

    sqlx::query!(
        "INSERT INTO l1_accounts (address, pubkey) VALUES ($1, $2)
         ON CONFLICT (address) DO UPDATE SET pubkey = COALESCE(l1_accounts.pubkey, EXCLUDED.pubkey)",
        body.author,
        &submission.author_pubkey,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(sealed)
}

/// The verified-act header a stored row was sealed as. Every act this
/// host seals carries the one content and one dependency edition, so the
/// editions are the constants, not columns.
fn stored_header(
    body: common::l1::StructuralBody,
    pre_commitment: Vec<u8>,
    pre_signature: Vec<u8>,
    content_commitment: Vec<u8>,
    dependency_commitment: Vec<u8>,
) -> VerifiedAct {
    VerifiedAct {
        body,
        pre_commitment,
        pre_signature,
        content_commitment,
        dependency_commitment,
        content_edition: CONTENT_EDITION,
        dependency_edition: DEPENDENCY_EDITION,
    }
}

/// Reads back the act stored under an identifier: its structural record
/// and dependency opening, and — while the host still holds the content
/// salt — the exact sealed act the host returned to its author, with
/// whether its approval is recorded (crate::StandIn::sealed_act).
pub(crate) async fn sealed_act(
    standin: &StandIn,
    act_id: &ActId,
) -> Result<Option<crate::StoredAct>, StandInError> {
    let row = sqlx::query!(
        "SELECT author, seq, family, middle, target, p_d, p_i,
                settlement_ref, license, asserted_parents, deps,
                dependency_nonce, pre_signature, pre_commitment,
                content_salt, deps_salt, content_commitment, deps_commitment,
                host_seal, status
         FROM l1_acts WHERE act_id = $1",
        act_id.to_string(),
    )
    .fetch_optional(standin.pool())
    .await?;
    let Some(row) = row else { return Ok(None) };
    let body = stored_body!(row).to_body()?;
    let deps = row
        .deps
        .iter()
        .map(|d| ActId::parse(d))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| StandInError::Formation(e.to_string()))?;
    let sealed = row.content_salt.map(|content_salt| SealedAct {
        act: stored_header(
            body.clone(),
            row.pre_commitment.clone(),
            row.pre_signature,
            row.content_commitment.clone(),
            row.deps_commitment,
        ),
        content_salt,
        dependency_salt: row.deps_salt,
        host_seal: row.host_seal,
    });
    Ok(Some(crate::StoredAct {
        body,
        deps,
        dependency_nonce: row.dependency_nonce,
        pre_commitment: row.pre_commitment,
        content_commitment: row.content_commitment,
        sealed,
        approved: row.status != "sealed",
    }))
}

/// Verifies the approval witness over the exact sealed act and marks it
/// approved. Idempotent once already approved: a repeat call re-checks
/// nothing and changes nothing.
pub(crate) async fn approve(
    standin: &StandIn,
    witness: ApprovalWitness,
) -> Result<(), StandInError> {
    let act_id = witness.act_id.to_string();
    let row = sqlx::query!(
        "SELECT author, seq, family, author_pubkey, middle, target, p_d, p_i,
                settlement_ref, license, asserted_parents, pre_signature,
                pre_commitment, content_commitment, deps_commitment, host_seal,
                status
         FROM l1_acts WHERE act_id = $1",
        act_id,
    )
    .fetch_optional(standin.pool())
    .await?
    .ok_or_else(|| StandInError::UnknownAct(act_id.clone()))?;

    if row.status != "sealed" {
        return Ok(());
    }

    let body = stored_body!(row).to_body()?;
    let seal_msg = stored_header(
        body,
        row.pre_commitment,
        row.pre_signature,
        row.content_commitment,
        row.deps_commitment,
    )
    .seal_message();
    let author_key = crypto::verifying_key_from_bytes(&row.author_pubkey)
        .ok_or_else(|| StandInError::Authentication("stored author key malformed".into()))?;
    if !crypto::verify_digest(
        &author_key,
        &approval_digest(&seal_msg, &row.host_seal),
        &witness.approval_signature,
    ) {
        return Err(StandInError::Authentication(
            "approval witness does not verify over the sealed act".into(),
        ));
    }

    sqlx::query!(
        "UPDATE l1_acts
         SET status = 'approved', approval_signature = $2, approved_at = NOW()
         WHERE act_id = $1 AND status = 'sealed'",
        act_id,
        &witness.approval_signature,
    )
    .execute(standin.pool())
    .await?;
    Ok(())
}

/// The ten stored columns a structural body is rebuilt from, borrowed off
/// whichever row carries them.
pub(crate) struct StoredBody<'a> {
    pub author: &'a str,
    pub seq: i64,
    pub family: &'a str,
    pub middle: Option<&'a str>,
    pub target: &'a str,
    pub p_d: f64,
    pub p_i: f64,
    pub settlement_ref: Option<&'a str>,
    pub license: Option<&'a str>,
    pub asserted_parents: &'a [String],
}

/// Borrows the body columns off a row of any of the three `l1_acts`
/// selections that carry them.
///
/// A macro rather than a function because `sqlx::query!` mints an anonymous
/// record type per query: the three rows share these field names but no
/// type a parameter could name. Written once here, so the ten columns are
/// listed in one place instead of at every call.
macro_rules! stored_body {
    ($row:expr) => {
        $crate::seal::StoredBody {
            author: &$row.author,
            seq: $row.seq,
            family: &$row.family,
            middle: $row.middle.as_deref(),
            target: &$row.target,
            p_d: $row.p_d,
            p_i: $row.p_i,
            settlement_ref: $row.settlement_ref.as_deref(),
            license: $row.license.as_deref(),
            asserted_parents: &$row.asserted_parents,
        }
    };
}
pub(crate) use stored_body;

impl StoredBody<'_> {
    /// Rebuilds the canonical structural body from stored columns.
    pub(crate) fn to_body(&self) -> Result<common::l1::StructuralBody, StandInError> {
        let formation = |e: common::l1::IdentifierError| StandInError::Formation(e.to_string());
        let family = common::l1::Family::parse(self.family).ok_or_else(|| {
            StandInError::Formation(format!("stored family {} unknown", self.family))
        })?;
        let body = common::l1::StructuralBody {
            author: self.author.to_string(),
            seq: self.seq as u64,
            family,
            middle: self
                .middle
                .map(NodeId::parse)
                .transpose()
                .map_err(formation)?,
            target: NodeId::parse(self.target).map_err(formation)?,
            p_d: self.p_d,
            p_i: self.p_i,
            settlement_ref: self
                .settlement_ref
                .map(ActId::parse)
                .transpose()
                .map_err(formation)?,
            license: self.license.map(str::to_string),
            asserted_parents: self
                .asserted_parents
                .iter()
                .map(|p| ActId::parse(p))
                .collect::<Result<Vec<_>, _>>()
                .map_err(formation)?,
        };
        Ok(body)
    }
}

/// One leg of an act's graph projection: its role, its two endpoints, and
/// the parameters the census renders for that role.
pub(crate) type ProjectionLeg = (common::l1::LegRole, NodeId, NodeId, f64, f64);

/// The legs of an act's graph projection (layer1-interface.md §8.1).
///
/// A hyper act without a middle is refused rather than panicked on. Nothing
/// this crate seals can be in that state — `endpoint_check` gates the only
/// insert — but the storage read path does not re-run formation and the
/// column is nullable, so a row written around this crate would otherwise
/// take a library path down.
pub(crate) fn projection_legs(
    body: &common::l1::StructuralBody,
) -> Result<Vec<ProjectionLeg>, StandInError> {
    use common::l1::census::{LegRole, leg_params};
    match body.family.kind() {
        FamilyKind::Binary => {
            let (p_d, p_i) = leg_params(LegRole::Binary, body.p_d, body.p_i);
            Ok(vec![(
                LegRole::Binary,
                body.source(),
                body.target.clone(),
                p_d,
                p_i,
            )])
        }
        FamilyKind::Hyper => {
            let middle = body.middle.clone().ok_or_else(|| {
                formation(format!(
                    "stored {} act {} carries no middle node",
                    body.family,
                    body.act_id()
                ))
            })?;
            let (a_pd, a_pi) = leg_params(LegRole::A, body.p_d, body.p_i);
            let (t_pd, t_pi) = leg_params(LegRole::T, body.p_d, body.p_i);
            Ok(vec![
                (LegRole::A, body.source(), middle.clone(), a_pd, a_pi),
                (LegRole::T, middle, body.target.clone(), t_pd, t_pi),
            ])
        }
    }
}
