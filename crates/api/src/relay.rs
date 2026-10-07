//! ´mod:module:relay´
//!
//! The relay legs of the write path — steps 3 and 5 of substrate.md §6:
//! submit the device's pre-signed proposal to the seal, store the sealed
//! verified act, relay the approval witness (holding an admission
//! Registration's until its funding settles), and — driven off the
//! ingestion pass — promote staged writes whose records land.
//!
//! The relay confers nothing: both signatures cover the act, so nothing
//! here can alter or author one (architecture.md "The write path").

use common::l1::crypto::{self, tags};
use common::l1::handshake::{ApprovalWitness, PreSignedProposal, VerifiedAct};
use postgres_store::PgPool;
use postgres_store::staged::{self, PreSignedParts, StagedState};
use uuid::Uuid;

use crate::l1::{BoundaryError, L1Boundary};

#[derive(Debug, thiserror::Error)]
pub enum RelayError {
    /// The submitted signature (or the proposal it covers) did not verify
    /// on the substrate — surfaced per act (api-spec.md
    /// `SIGNATURE_INVALID`). Nothing was sealed into a verified act
    /// (layer1-interface.md §8.2), so the device may fix and retry.
    #[error("signature invalid: {0}")]
    SignatureInvalid(String),
    /// The staged write lost its sealed act — a relay crash between seal
    /// and store, or a re-seal the substrate refuses as a conflict because
    /// it already sealed the act. Unrecoverable either way, because the
    /// host salts cannot be re-fetched. The write is expired; the device
    /// re-prepares under a fresh sequence value.
    #[error("staged write {0} lost its seal; re-prepare")]
    Wedged(Uuid),
    /// A resubmission whose pre-commitment differs from the sealed one —
    /// returning the stored act would tell a re-signing client its new
    /// bytes were sealed. Refused; only a byte-identical replay is
    /// answered idempotently.
    #[error("staged write {0}: resubmitted pre-commitment differs from the sealed one")]
    ReplayMismatch(Uuid),
    /// The pre-commitment was recorded but its display rows could not be
    /// put on screen. The write is intact and a retry of the leg heals it;
    /// serving the content as if it were invisible is not an option.
    #[error("staged content could not be made readable: {0}")]
    Staging(#[from] crate::content::ContentError),
    #[error(transparent)]
    Staged(#[from] staged::StagedError),
    #[error(transparent)]
    Boundary(BoundaryError),
    /// The admission funding a Registration's relay waits on could not
    /// be read; the device's retry of the leg runs it again.
    #[error("admission funding: {0}")]
    Funding(String),
}

fn wrong_state(id: Uuid, expected: &str, actual: StagedState) -> RelayError {
    RelayError::Staged(staged::StagedError::WrongState {
        id,
        expected: expected.to_string(),
        actual: actual.as_str().to_string(),
    })
}

/// Relay leg 1 — seal: store the device's pre-commitment, submit through
/// the boundary, and store the host-sealed verified act. Returns the
/// sealed act for the device's approval step. Re-submission after a lost
/// response is idempotent: an already-sealed write returns its stored act
/// — but only for the exact pre-commitment that was sealed; differing
/// bytes are refused (`ReplayMismatch`).
///
/// The pre-commitment is the anchor: from it on, the content is the
/// author's, readable by everyone and marked pending (substrate.md §6).
/// Staging it therefore fails the whole leg rather than degrading to
/// invisible content, and the device's retry re-runs both steps
/// idempotently. Staging can also fail deterministically — a comment
/// whose parent was discarded between prepare and pre-sign fails every
/// retry — so the write is handed back to `awaiting_pre_sign` instead of
/// being left in `sealing`, where it would wedge until GC and block the
/// author's next edit of the node.
pub async fn submit_pre_signed<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    id: Uuid,
    pre: PreSignedParts,
) -> Result<VerifiedAct, RelayError> {
    let write = staged::load(pool, id).await?;
    match write.state {
        StagedState::AwaitingPreSign | StagedState::Sealing => {}
        StagedState::AwaitingApproval | StagedState::Relaying => {
            if write.pre_signed.as_ref() != Some(&pre) {
                return Err(RelayError::ReplayMismatch(id));
            }
            return write.verified_act().ok_or(RelayError::Wedged(id));
        }
        other => return Err(wrong_state(id, "awaiting_pre_sign", other)),
    }
    let pre_signed_at = staged::record_pre_signed(pool, id, &pre).await?;
    if let Err(e) = crate::content::stage_pending(pool, &write, pre_signed_at).await {
        if let Err(revert) = staged::revert_to_pre_sign(pool, id).await {
            tracing::error!(
                staged = %id,
                error = %revert,
                "staging failed and the revert failed too; the write stays in sealing"
            );
        }
        return Err(RelayError::Staging(e));
    }
    let pre_signed = PreSignedProposal {
        proposal: write.proposal.clone(),
        author_pubkey: pre.author_pubkey,
        nonce: pre.nonce,
        pre_signature: pre.pre_signature,
    };
    match boundary.seal(pre_signed).await {
        Ok(act) => {
            staged::record_sealed(pool, id, &act).await?;
            Ok(act)
        }
        Err(BoundaryError::Formation(m)) | Err(BoundaryError::Authentication(m)) => {
            staged::revert_to_pre_sign(pool, id).await?;
            Err(RelayError::SignatureInvalid(m))
        }
        Err(BoundaryError::Conflict(_)) => {
            staged::expire_one(pool, id, write.prepared_epoch).await?;
            Err(RelayError::Wedged(id))
        }
        Err(e) => {
            staged::revert_to_pre_sign(pool, id).await?;
            Err(RelayError::Boundary(e))
        }
    }
}

/// Relay leg 2 — approve: relay the device's approval witness; only an
/// approved act is orderable. Landing stays asynchronous — the ingestion
/// pass confirms it (architecture.md "Record ingestion"). Retry from
/// `relaying` is accepted: the substrate's approve is idempotent.
///
/// The one leg the relay holds: an unchained admission Registration whose
/// address's funding has not settled (auth.md "Funding"). Its witness is
/// checked here, stored with the write in `relaying`, and relayed by the
/// settlement pass once the burn settles — so the act is never orderable
/// before its author can pay for it, and the device, which already reads
/// `relaying` as "the backend drives it", needs nothing more. Leg 1 is
/// never held: the seal checks no solvency (layer1-interface.md §8.2).
///
/// The funding is read again once the hold is stored: a settlement pass
/// that ran between the first read and the hold found no hold to relay.
/// Whichever side sees both facts relays, and relaying twice is
/// idempotent, so no hold is stranded by the race.
pub async fn submit_approval<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    id: Uuid,
    approval_signature: Vec<u8>,
) -> Result<(), RelayError> {
    let write = staged::load(pool, id).await?;
    match write.state {
        StagedState::AwaitingApproval | StagedState::Relaying => {}
        other => return Err(wrong_state(id, "awaiting_approval", other)),
    }
    if waits_for_funding(boundary, pool, &write).await? {
        check_witness(&write, &approval_signature)?;
        staged::hold_approval(pool, id, &approval_signature).await?;
        if !waits_for_funding(boundary, pool, &write).await? {
            relay_held(boundary, pool, id, approval_signature).await?;
        }
        return Ok(());
    }
    let witness = ApprovalWitness {
        act_id: write.proposal.body.act_id(),
        approval_signature,
    };
    match boundary.approve(witness).await {
        Ok(()) => {
            staged::record_relaying(pool, id).await?;
            Ok(())
        }
        Err(BoundaryError::Authentication(m)) => Err(RelayError::SignatureInvalid(m)),
        Err(e) => Err(RelayError::Boundary(e)),
    }
}

/// The relay's view of [crate::onboarding::awaits_funding].
async fn waits_for_funding<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    write: &staged::StagedWrite,
) -> Result<bool, RelayError> {
    crate::onboarding::awaits_funding(pool, boundary, write)
        .await
        .map_err(|e| RelayError::Funding(e.to_string()))
}

/// Verifies a witness the relay is about to hold, exactly as the host
/// would at approve: a held witness is relayed later by a pass the device
/// never hears from, so a bad signature must be refused now, while the
/// device can still fix it.
fn check_witness(write: &staged::StagedWrite, approval_signature: &[u8]) -> Result<(), RelayError> {
    let act = write.verified_act().ok_or(RelayError::Wedged(write.id))?;
    let key = crypto::verifying_key_from_bytes(&act.author_pubkey).ok_or_else(|| {
        RelayError::SignatureInvalid("the sealed act's author key is malformed".into())
    })?;
    if crypto::verify(&key, tags::APPROVAL, &act.seal_msg(), approval_signature) {
        Ok(())
    } else {
        Err(RelayError::SignatureInvalid(
            "approval witness does not verify over the sealed act".into(),
        ))
    }
}

/// Relays a held approval leg and clears the hold — the settlement pass's
/// half of the admission Registration's relay, and the hold's own re-check
/// when the funding settled under it. Idempotent: the substrate's approve
/// is, and the hold is cleared only for the witness that was relayed.
pub async fn relay_held<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    id: Uuid,
    approval_signature: Vec<u8>,
) -> Result<(), RelayError> {
    let write = staged::load(pool, id).await?;
    let witness = ApprovalWitness {
        act_id: write.proposal.body.act_id(),
        approval_signature: approval_signature.clone(),
    };
    match boundary.approve(witness).await {
        Ok(()) => {
            staged::release_held_approval(pool, id, &approval_signature).await?;
            tracing::info!(staged = %id, "held admission Registration relayed after its funding settled");
            Ok(())
        }
        Err(BoundaryError::Authentication(m)) => Err(RelayError::SignatureInvalid(m)),
        Err(e) => Err(RelayError::Boundary(e)),
    }
}
