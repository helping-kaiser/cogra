//! ´mod:module:l1´
//!
//! The single L1 interface boundary (architecture.md §5 "The seam is one
//! boundary").
//!
//! All substrate access on the request path — relaying signed records
//! over the two handshake legs, ingesting accepted records, reading the
//! B_i export and the published θ — flows through this trait, and nothing
//! else on that path speaks to the substrate.
//!
//! The swap is this trait plus a named list beside it, not this trait
//! alone. `l1_standin::DevSubstrate` collects the surfaces that are
//! deliberately *not* the seam and that CoGra reaches for anyway:
//! crediting a burn (a Layer-0 economy CoGra does not run), closing an
//! epoch (a clock the real substrate keeps itself), and reading back a
//! sealed act (a crash-recovery affordance for the bootstrap). Each needs
//! its own answer at the swap — a real L0 rail, the substrate's own
//! close, a resumable bootstrap — so "one new implementation here" is
//! true of the request path and not of the whole system (roadmap.md "The
//! stand-in and the swap").

use std::future::Future;

use common::l1::handshake::{AccountBalance, ApprovalWitness, EpochPackage};
use common::l1::{PreSignedProposal, VerifiedAct};
use l1_standin::{StandIn, StandInError};

/// Boundary failures, by contract meaning rather than transport detail.
#[derive(Debug, thiserror::Error)]
pub enum BoundaryError {
    /// The submission produced no Layer-1 object (formation-invalid).
    #[error("formation: {0}")]
    Formation(String),
    /// A signature, commitment, or key binding failed.
    #[error("authentication: {0}")]
    Authentication(String),
    /// Identifier equivocation or reuse.
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("unknown act {0}")]
    UnknownAct(String),
    /// The substrate itself failed (storage, transport).
    #[error("substrate: {0}")]
    Substrate(String),
}

impl From<StandInError> for BoundaryError {
    fn from(e: StandInError) -> Self {
        match e {
            StandInError::Formation(m) => BoundaryError::Formation(m),
            StandInError::Authentication(m) => BoundaryError::Authentication(m),
            StandInError::Conflict(m) => BoundaryError::Conflict(m),
            StandInError::UnknownAct(m) => BoundaryError::UnknownAct(m),
            StandInError::Host(m) => BoundaryError::Substrate(m),
            StandInError::Storage(e) => BoundaryError::Substrate(e.to_string()),
        }
    }
}

/// The seam contract: the two relay legs of the admission handshake, the
/// epoch-package read ingestion consumes, the B_i read, and the published
/// θ price the write-rule pre-check estimates against
/// (layer1-interface.md §11.8 — the certificate carries θ with a
/// one-boundary lead). Prepare is L2 orchestration in front of the seam,
/// not a seam operation (substrate.md §6 step 1).
pub trait L1Boundary: Send + Sync {
    /// Relay leg 1: submit the pre-signed proposal; the host verifies,
    /// salts, and returns the sealed verified act.
    fn seal(
        &self,
        pre: PreSignedProposal,
    ) -> impl Future<Output = Result<VerifiedAct, BoundaryError>> + Send;

    /// Relay leg 2: submit the approval witness; the act becomes
    /// orderable.
    fn approve(
        &self,
        witness: ApprovalWitness,
    ) -> impl Future<Output = Result<(), BoundaryError>> + Send;

    /// Every published epoch after `after`, in order (the mirror's
    /// ingestion input — architecture.md "Record ingestion").
    fn epochs_since(
        &self,
        after: i64,
    ) -> impl Future<Output = Result<Vec<EpochPackage>, BoundaryError>> + Send;

    /// The B_i export, read-only (consume-only; CoGra never authors L0
    /// records).
    fn balance(
        &self,
        address: &str,
    ) -> impl Future<Output = Result<AccountBalance, BoundaryError>> + Send;

    /// The host key clients verify seals against (realization
    /// transparency — every host-added field checkable before approval).
    fn host_public_key(&self) -> impl Future<Output = Result<Vec<u8>, BoundaryError>> + Send;

    /// The θ price the next act debits, in the units `balance` reports —
    /// the published safety price the prepare pre-check reads
    /// (layer1-interface.md §11.8; substrate.md §6 "an L2 estimate from
    /// the last published certificate").
    fn current_theta(&self) -> impl Future<Output = Result<f64, BoundaryError>> + Send;

    /// The published per-act carriage bound M_payload the prepare
    /// pre-check reads — consume-only, like every binding constant
    /// (layer1-interface.md "Payload envelope convention (L2)").
    fn max_payload_bytes(&self) -> impl Future<Output = Result<usize, BoundaryError>> + Send;
}

/// The stand-in behind the seam.
#[derive(Clone)]
pub struct StandInBoundary(pub StandIn);

impl L1Boundary for StandInBoundary {
    async fn seal(&self, pre: PreSignedProposal) -> Result<VerifiedAct, BoundaryError> {
        Ok(self.0.seal(pre).await?)
    }

    async fn approve(&self, witness: ApprovalWitness) -> Result<(), BoundaryError> {
        Ok(self.0.approve(witness).await?)
    }

    async fn epochs_since(&self, after: i64) -> Result<Vec<EpochPackage>, BoundaryError> {
        Ok(self.0.epochs_since(after).await?)
    }

    async fn balance(&self, address: &str) -> Result<AccountBalance, BoundaryError> {
        Ok(self.0.balance(address).await?)
    }

    async fn host_public_key(&self) -> Result<Vec<u8>, BoundaryError> {
        Ok(self.0.host_public_key().await?)
    }

    async fn current_theta(&self) -> Result<f64, BoundaryError> {
        Ok(self.0.config().theta_micro as f64 / 1e6)
    }

    async fn max_payload_bytes(&self) -> Result<usize, BoundaryError> {
        Ok(self.0.config().max_payload_bytes)
    }
}
