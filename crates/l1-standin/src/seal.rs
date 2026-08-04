// The two relay legs of the admission handshake, host side
// (layer1-interface.md §8.2): seal — verify the pre-signed proposal, add
// salts, form the binding commitments, seal the verified act; approve —
// verify the approval witness over the exact sealed act. Only a verified
// act with a valid approval witness is eligible for ordering.

use common::l1::census::FamilyKind;
use common::l1::crypto::{self, tags};
use common::l1::handshake::{
    ApprovalWitness, PreSignedProposal, VerifiedAct, canonical_deps, pre_commitment_msg,
};
use common::l1::identifier::{ActId, NodeId};
use rand::RngCore;
use rand::rngs::OsRng;

use crate::{StandIn, StandInError};

/// Bound on declared dependencies + asserted parents — the "dependency
/// bounds" of `def:graph:verified-act`; a stand-in operating value.
const MAX_DEPS: usize = 64;

fn formation(msg: impl Into<String>) -> StandInError {
    StandInError::Formation(msg.into())
}

pub(crate) async fn seal(
    standin: &StandIn,
    pre: PreSignedProposal,
) -> Result<VerifiedAct, StandInError> {
    let body = &pre.proposal.body;
    let family = body.family;

    // Canonical formation: identifiers well-formed by construction of the
    // typed body; endpoint typing and the parameter tuple per the census.
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

    // Minted-endpoint rules (`def:graph:genesis-act-and-creator`): a
    // self-minted target (mint of this very act) is valid exactly for the
    // genesis families. Genesis identity is per record, so an ordinary-role
    // act toward an existing mint — a Publish revising its Content node —
    // is well-formed; the fold, never formation, decides what it means.
    // Foreign minted references are permitted even when unanchored:
    // dangling identifiers are fold-neutral, never a formation failure
    // (`lem:graph:dangling-neutral-fold`).
    // A founding Participant self-loops at its own mint — both legs enter
    // the Chat the act creates — so the middle-node rule exempts exactly
    // that shape.
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
    // Bid/T alone is fresh-mint-only (Edition-5 draft §3.9): a Bid toward
    // an existing Offer would hang a second Item's incidence on it — real
    // raw incidence, live in CAN and sentiment even where no fold reads
    // it. Offer revision is a new Offer.
    if family == common::l1::Family::Bid && body.target != own_mint {
        return Err(formation(
            "bid mints its Offer: the terminal target must be the act's own mint",
        ));
    }

    // Carriage and dependency bounds.
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

    // Authorship: the stated author's key binds to the address, and the
    // pre-commitment verifies over the exact proposal.
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

    // Key consistency across the author's history: one key per address.
    let existing = sqlx::query!(
        "SELECT pubkey FROM l1_accounts WHERE address = $1",
        body.author
    )
    .fetch_optional(standin.pool())
    .await?;
    if let Some(row) = &existing
        && let Some(known) = &row.pubkey
        && known != &pre.author_pubkey
    {
        return Err(StandInError::Authentication(
            "author address is bound to a different key".into(),
        ));
    }

    // Host additions: fresh domain-separated salts meeting the entropy
    // floor, binding + concealing commitments, the host seal.
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

    // Persist the sealed act. The insert is the uniqueness check: a second
    // record claiming the same act identifier (or reusing the author-local
    // sequence) is equivocation and produces no Layer-1 object.
    let parents: Vec<String> = body
        .asserted_parents
        .iter()
        .map(|p| p.to_string())
        .collect();
    let deps: Vec<String> = pre.proposal.deps.iter().map(|d| d.to_string()).collect();
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
    .execute(standin.pool())
    .await?;
    if inserted.rows_affected() == 0 {
        return Err(StandInError::Conflict(format!(
            "act identifier {act_id} (or its author-local sequence) already exists"
        )));
    }

    // Learn the author's key on first contact (account may pre-exist from
    // a burn credit with no key yet).
    sqlx::query!(
        "INSERT INTO l1_accounts (address, pubkey) VALUES ($1, $2)
         ON CONFLICT (address) DO UPDATE SET pubkey = COALESCE(l1_accounts.pubkey, EXCLUDED.pubkey)",
        body.author,
        &pre.author_pubkey,
    )
    .execute(standin.pool())
    .await?;

    Ok(act)
}

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
        // Approval is idempotent once recorded; anything else re-checks
        // nothing and changes nothing.
        return Ok(());
    }

    // Rebuild the exact sealed message and verify the witness over it.
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

/// The seal message from stored parts — must match
/// `VerifiedAct::seal_msg` byte for byte.
pub(crate) fn seal_message(
    body: &common::l1::StructuralBody,
    pre_signature: &[u8],
    content_commitment: &[u8],
    deps_commitment: &[u8],
) -> Vec<u8> {
    use common::l1::encoding::Encoder;
    let mut e = Encoder::new();
    e.array(5);
    e.bytes(&body.canonical_bytes());
    e.bytes(pre_signature);
    e.bytes(content_commitment);
    e.bytes(deps_commitment);
    e.uint(1);
    e.finish()
}

/// The legs of an act's graph projection, as (role, source, target) with
/// the leg-rendered parameters (`def:graph:act-edge-projection`).
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
