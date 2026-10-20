//! ´mod:module:error´
//!
//! Why the ranker produced no answer.
//!
//! Every refusal is loud and typed (ranker-core §3.9): a silently skipped
//! record or a quietly clamped parameter would be a divergent computation,
//! and "never deviate silently" binds math as much as prose.

use crate::census::{Family, LegRole};

#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum RankError {
    /// A viewer-tunable parameter outside its domain (miner-api.md
    /// "Inputs"; ranker-core §3.7). `field` is the parameter's wire name.
    #[error("the parameter {field} is out of range: {reason}")]
    BadInput { field: String, reason: String },
    /// The published network parameters break their own domains — a
    /// governance or carrier fault, never the viewer's.
    #[error("the network parameters are unusable: {reason}")]
    NetworkParameters { reason: String },
    /// The slice breaks the contract it is read under: a leg the census does
    /// not have, a parameter outside `[-1, 1]`, a maturity outside `[0, 1]`,
    /// a leg endpoint absent from the node set, a repeated record id, or two
    /// records claiming one causal key.
    #[error("the slice is malformed: {reason}")]
    MalformedSlice { reason: String },
    /// The slice holds a record of a family whose feed traversal needs an
    /// L2 fold this ranker does not build yet — chat lineages and inviter
    /// revocation (feed-ranking.md §3.2, §4; ranker-core §3.9).
    #[error("record {record_id} is a {family} record, which this ranker does not fold yet")]
    UnsupportedFamily { record_id: String, family: Family },
}

impl RankError {
    pub(crate) fn malformed(reason: impl Into<String>) -> Self {
        RankError::MalformedSlice {
            reason: reason.into(),
        }
    }

    pub(crate) fn no_such_leg(family: Family, role: LegRole) -> Self {
        RankError::malformed(format!("{family} has no {role} leg in the census"))
    }
}
