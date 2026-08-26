//! ´mod:module:seal´
//!
//! Host side of the admission handshake's two relay legs
//! (layer1-interface.md §8.2). `seal` verifies the pre-signed proposal,
//! adds salts, forms the binding commitments, and seals the verified
//! act; `approve` verifies the approval witness over that exact sealed
//! act. Ordering admits only a verified act carrying a valid approval
//! witness.

use common::l1::census::FamilyKind;
use common::l1::crypto::{self, tags};
use common::l1::handshake::{
    ApprovalWitness, PreSignedProposal, VerifiedAct, canonical_deps, pre_commitment_msg,
    seal_message,
};
use common::l1::identifier::{ActId, NodeId};
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

/// Verifies a pre-signed proposal and seals it into a verified act
/// (layer1-interface.md §8.2), enforcing:
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
/// - **Carriage and dependency bounds**, checked against
///   `StandInConfig::max_payload_bytes` and `MAX_DEPS`.
/// - **Authorship.** The stated author's key binds to the address, and
///   the pre-commitment verifies over the exact proposal. Key
///   consistency across the author's history needs no separate check:
///   the address derives from the key, so this binding already pins it.
/// - **Host additions.** Fresh domain-separated salts meeting the
///   entropy floor, the binding and concealing commitments, and the
///   host seal.
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
    pre: PreSignedProposal,
) -> Result<VerifiedAct, StandInError> {
    let body = &pre.proposal.body;
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

    if pre.proposal.payload.len() > standin.config().max_payload_bytes {
        return Err(formation(format!(
            "payload exceeds M_payload ({} > {})",
            pre.proposal.payload.len(),
            standin.config().max_payload_bytes
        )));
    }
    if pre.proposal.deps.len() + body.asserted_parents.len() > MAX_DEPS {
        return Err(formation("dependency list exceeds the bound"));
    }

    let author_key = crypto::verifying_key_from_bytes(&pre.author_pubkey)
        .ok_or_else(|| StandInError::Authentication("malformed author public key".into()))?;
    if crypto::address_of(&author_key) != body.author {
        return Err(StandInError::Authentication(
            "author public key does not bind to the author address".into(),
        ));
    }
    let digest_content =
        crypto::pre_digest(tags::PRE_DIGEST_CONTENT, &pre.nonce, &pre.proposal.payload);
    let digest_deps = crypto::pre_digest(
        tags::PRE_DIGEST_DEPS,
        &pre.nonce,
        &canonical_deps(&pre.proposal.deps),
    );
    let msg = pre_commitment_msg(body, &digest_content, &digest_deps);
    if !crypto::verify(&author_key, tags::PRE_COMMITMENT, &msg, &pre.pre_signature) {
        return Err(StandInError::Authentication(
            "pre-commitment signature does not verify".into(),
        ));
    }

    let mut content_salt = vec![0u8; crypto::SALT_LEN];
    let mut deps_salt = vec![0u8; crypto::SALT_LEN];
    OsRng.fill_bytes(&mut content_salt);
    OsRng.fill_bytes(&mut deps_salt);
    let content_commitment =
        crypto::commitment(tags::COMMIT_CONTENT, &content_salt, &pre.proposal.payload).to_vec();
    let deps_commitment = crypto::commitment(
        tags::COMMIT_DEPS,
        &deps_salt,
        &canonical_deps(&pre.proposal.deps),
    )
    .to_vec();

    let mut act = VerifiedAct {
        proposal: pre.proposal.clone(),
        author_pubkey: pre.author_pubkey.clone(),
        nonce: pre.nonce.clone(),
        pre_signature: pre.pre_signature.clone(),
        content_salt,
        deps_salt,
        content_commitment,
        deps_commitment,
        host_seal: vec![],
    };
    let host_key = standin.host_key().await?;
    act.host_seal = crypto::sign(&host_key, tags::HOST_SEAL, &act.seal_msg());

    let parents: Vec<String> = body
        .asserted_parents
        .iter()
        .map(|p| p.to_string())
        .collect();
    let deps: Vec<String> = pre.proposal.deps.iter().map(|d| d.to_string()).collect();
    let mut tx = standin.pool().begin().await?;
    let inserted = sqlx::query!(
        "INSERT INTO l1_acts (
            act_id, author, seq, family, author_pubkey, middle, target,
            p_d, p_i, settlement_ref, license, asserted_parents, deps,
            payload, nonce, pre_signature, content_salt, deps_salt,
            content_commitment, deps_commitment, host_seal, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'sealed')
         ON CONFLICT DO NOTHING",
        act_id.to_string(),
        body.author,
        body.seq as i64,
        family.as_str(),
        &pre.author_pubkey,
        body.middle.as_ref().map(|m| m.to_string()),
        body.target.to_string(),
        body.p_d,
        body.p_i,
        body.settlement_ref.as_ref().map(|r| r.to_string()),
        body.license,
        &parents,
        &deps,
        &pre.proposal.payload,
        &pre.nonce,
        &pre.pre_signature,
        &act.content_salt,
        &act.deps_salt,
        &act.content_commitment,
        &act.deps_commitment,
        &act.host_seal,
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
        &pre.author_pubkey,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(act)
}

/// Reads back the act stored under an identifier, rebuilt as the exact
/// sealed object the host returned to its author, with whether its
/// approval is recorded (crate::StandIn::sealed_act).
pub(crate) async fn sealed_act(
    standin: &StandIn,
    act_id: &ActId,
) -> Result<Option<crate::StoredAct>, StandInError> {
    let row = sqlx::query!(
        "SELECT author, seq, family, author_pubkey, middle, target, p_d, p_i,
                settlement_ref, license, asserted_parents, deps, payload,
                nonce, pre_signature, content_salt, deps_salt,
                content_commitment, deps_commitment, host_seal, status
         FROM l1_acts WHERE act_id = $1",
        act_id.to_string(),
    )
    .fetch_optional(standin.pool())
    .await?;
    let Some(row) = row else { return Ok(None) };
    let body = rebuild_body(
        &row.author,
        row.seq,
        &row.family,
        row.middle.as_deref(),
        &row.target,
        row.p_d,
        row.p_i,
        row.settlement_ref.as_deref(),
        row.license.as_deref(),
        &row.asserted_parents,
    )?;
    let deps = row
        .deps
        .iter()
        .map(|d| ActId::parse(d))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| StandInError::Formation(e.to_string()))?;
    Ok(Some(crate::StoredAct {
        act: VerifiedAct {
            proposal: common::l1::handshake::Proposal {
                body,
                payload: row.payload,
                deps,
            },
            author_pubkey: row.author_pubkey,
            nonce: row.nonce,
            pre_signature: row.pre_signature,
            content_salt: row.content_salt,
            deps_salt: row.deps_salt,
            content_commitment: row.content_commitment,
            deps_commitment: row.deps_commitment,
            host_seal: row.host_seal,
        },
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
                content_commitment, deps_commitment, status
         FROM l1_acts WHERE act_id = $1",
        act_id,
    )
    .fetch_optional(standin.pool())
    .await?
    .ok_or_else(|| StandInError::UnknownAct(act_id.clone()))?;

    if row.status != "sealed" {
        return Ok(());
    }

    let body = rebuild_body(
        &row.author,
        row.seq,
        &row.family,
        row.middle.as_deref(),
        &row.target,
        row.p_d,
        row.p_i,
        row.settlement_ref.as_deref(),
        row.license.as_deref(),
        &row.asserted_parents,
    )?;
    let seal_msg = seal_message(
        &body,
        &row.pre_signature,
        &row.content_commitment,
        &row.deps_commitment,
    );
    let author_key = crypto::verifying_key_from_bytes(&row.author_pubkey)
        .ok_or_else(|| StandInError::Authentication("stored author key malformed".into()))?;
    if !crypto::verify(
        &author_key,
        tags::APPROVAL,
        &seal_msg,
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

/// Rebuilds the canonical structural body from stored columns.
#[expect(
    clippy::too_many_arguments,
    reason = "column-to-field mapping; a struct here would just rename the row"
)]
pub(crate) fn rebuild_body(
    author: &str,
    seq: i64,
    family: &str,
    middle: Option<&str>,
    target: &str,
    p_d: f64,
    p_i: f64,
    settlement_ref: Option<&str>,
    license: Option<&str>,
    asserted_parents: &[String],
) -> Result<common::l1::StructuralBody, StandInError> {
    let family = common::l1::Family::parse(family)
        .ok_or_else(|| StandInError::Formation(format!("stored family {family} unknown")))?;
    let middle = middle
        .map(NodeId::parse)
        .transpose()
        .map_err(|e| StandInError::Formation(e.to_string()))?;
    let target = NodeId::parse(target).map_err(|e| StandInError::Formation(e.to_string()))?;
    let asserted_parents = asserted_parents
        .iter()
        .map(|p| ActId::parse(p))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| StandInError::Formation(e.to_string()))?;
    Ok(common::l1::StructuralBody {
        author: author.to_string(),
        seq: seq as u64,
        family,
        middle,
        target,
        p_d,
        p_i,
        settlement_ref: settlement_ref
            .map(ActId::parse)
            .transpose()
            .map_err(|e| StandInError::Formation(e.to_string()))?,
        license: license.map(str::to_string),
        asserted_parents,
    })
}

/// The legs of an act's graph projection, as (role, source, target) with
/// the leg-rendered parameters (layer1-interface.md §8.1).
pub(crate) fn projection_legs(
    body: &common::l1::StructuralBody,
) -> Vec<(common::l1::LegRole, NodeId, NodeId, f64, f64)> {
    use common::l1::census::{LegRole, leg_params};
    match body.family.kind() {
        FamilyKind::Binary => {
            let (p_d, p_i) = leg_params(LegRole::Binary, body.p_d, body.p_i);
            vec![(
                LegRole::Binary,
                body.source(),
                body.target.clone(),
                p_d,
                p_i,
            )]
        }
        FamilyKind::Hyper => {
            let middle = body
                .middle
                .clone()
                .expect("hyper act formation guarantees a middle node");
            let (a_pd, a_pi) = leg_params(LegRole::A, body.p_d, body.p_i);
            let (t_pd, t_pi) = leg_params(LegRole::T, body.p_d, body.p_i);
            vec![
                (LegRole::A, body.source(), middle.clone(), a_pd, a_pi),
                (LegRole::T, middle, body.target.clone(), t_pd, t_pi),
            ]
        }
    }
}
