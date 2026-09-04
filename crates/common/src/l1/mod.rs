//! ´mod:module:l1´
//!
//! The L1 seam data model — the shared vocabulary of the Layer 1 → Layer 2
//! interface (docs/primitive/layer1-interface.md).
//!
//! Everything here is substrate contract, not CoGra state.

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
pub use client::{ActorKey, ClientError};
pub use fold::{BundleSum, NetStance};
pub use handshake::{
    AccountBalance, ApprovalWitness, EpochPackage, PreSignedProposal, Proposal, PublishedLeg,
    PublishedRecord, StructuralBody, VerifiedAct,
};
pub use identifier::{ActId, IdentifierError, NodeId};
