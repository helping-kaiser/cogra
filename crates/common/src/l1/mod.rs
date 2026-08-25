// The L1 seam data model — the shared vocabulary of the Layer 1 → Layer 2
// interface (docs/primitive/layer1-interface.md). Everything here is
// substrate contract, not CoGra state.

pub mod census;
pub mod client;
pub mod crypto;
pub mod encoding;
pub mod fold;
pub mod handshake;
pub mod identifier;
pub mod key_backup;
pub mod wire;

pub use census::{Domain, Family, FamilyKind, LegRole, LegSpec, Tier};
pub use client::ActorKey;
pub use fold::{BundleSum, NetStance};
pub use handshake::{
    AccountBalance, ApprovalWitness, EpochPackage, PreSignedProposal, Proposal, PublishedLeg,
    PublishedRecord, StructuralBody, VerifiedAct,
};
pub use identifier::{ActId, IdentifierError, NodeId};

/// Errors shared across the seam objects.
#[derive(Debug, thiserror::Error)]
pub enum L1Error {
    #[error("malformed identifier: {0}")]
    Identifier(#[from] identifier::IdentifierError),
    #[error("formation-invalid act: {0}")]
    Formation(String),
    #[error("authentication failure: {0}")]
    Authentication(String),
    #[error("unknown act: {0}")]
    UnknownAct(String),
    #[error("substrate failure: {0}")]
    Substrate(String),
}
