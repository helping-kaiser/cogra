// The L1 seam data model — the shared vocabulary of the Layer 1 → Layer 2
// interface (docs/primitive/layer1-interface.md). Everything here is
// substrate contract, not CoGra state: identifiers (§8.1), the edge census
// (§9), the canonical structural body and its encoding (§8.4), the
// admission-handshake objects (§8.2), and the epoch package the mirror
// ingests (§11.6).
//
// The cryptographic realization (crypto.rs) is the stand-in-scoped interim
// choice recorded under open-questions.md Q30: Ed25519 signatures, SHA-256
// salted hash commitments, canonical CBOR serialization. L1 prescribes
// properties, not schemes (`rem:graph:authentication-realization-out-of-scope`).

pub mod census;
pub mod client;
pub mod crypto;
pub mod encoding;
pub mod handshake;
pub mod identifier;

pub use census::{Domain, Family, FamilyKind, LegRole, LegSpec, Tier};
pub use client::ActorKey;
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
