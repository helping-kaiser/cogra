// The relay legs of the write path — steps 3 and 5 of substrate.md §6:
// submit the device's pre-signed proposal to the seal, store the sealed
// verified act, relay the approval witness, and (driven off the ingestion
// pass) promote staged writes whose records land. The relay confers
// nothing: both signatures cover the act, so nothing here can alter or
// author one (architecture.md "The write path").

use common::l1::handshake::{ApprovalWitness, PreSignedProposal, VerifiedAct};
use postgres_store::PgPool;
use postgres_store::staged::{self, PreSignedParts, StagedState};
use uuid::Uuid;

use crate::l1::{BoundaryError, L1Boundary};

#[derive(Debug, thiserror::Error)]
pub enum RelayError {
    /// The submitted signature (or the proposal it covers) did not verify
    /// on the substrate — surfaced per act (api-spec.md
    /// `SIGNATURE_INVALID`).
    #[error("signature invalid: {0}")]
    SignatureInvalid(String),
    /// The staged write lost its sealed act (a relay crash between seal
    /// and store) — unrecoverable, because the host salts cannot be
    /// re-fetched. The write is expired; the device re-prepares under a
    /// fresh sequence value.
    #[error("staged write {0} lost its seal; re-prepare")]
    Wedged(Uuid),
    /// A resubmission whose pre-commitment differs from the sealed one —
    /// returning the stored act would tell a re-signing client its new
    /// bytes were sealed. Refused; only a byte-identical replay is
    /// answered idempotently.
    #[error("staged write {0}: resubmitted pre-commitment differs from the sealed one")]
    ReplayMismatch(Uuid),
    #[error(transparent)]
    Staged(#[from] staged::StagedError),
    #[error(transparent)]
    Boundary(BoundaryError),
}

fn wrong_state(id: Uuid, expected: &'static str, actual: StagedState) -> RelayError {
    RelayError::Staged(staged::StagedError::WrongState {
        id,
        expected,
        actual: actual.as_str().to_string(),
    })
}

/// Relay leg 1 — seal: store the device's pre-commitment, submit through
/// the boundary, and store the host-sealed verified act. Returns the
/// sealed act for the device's approval step. Re-submission after a lost
/// response is idempotent: an already-sealed write returns its stored act
/// — but only for the exact pre-commitment that was sealed; differing
/// bytes are refused (`ReplayMismatch`).
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
    staged::record_pre_signed(pool, id, &pre).await?;
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
            // No Layer-1 object exists for the refused submission
            // (`def:graph:verified-act`); the device may fix and retry.
            staged::revert_to_pre_sign(pool, id).await?;
            Err(RelayError::SignatureInvalid(m))
        }
        Err(BoundaryError::Conflict(_)) => {
            // The act is sealed on the substrate but the sealed form was
            // lost before it could be stored — the salts are gone, so no
            // approval can ever be produced. Terminal: expire now; the
            // device re-prepares under a fresh sequence value.
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
