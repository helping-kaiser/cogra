//! ´mod:module:output´
//!
//! What the ranker answers: miner-api.md's `FeedEntry`, `TieBreakers`,
//! `RankPath` and `RankHop`, field for field, at the id level (RC-G1 (c)):
//! nodes are their raw L1 identifiers and records their L1 record ids, so a
//! consumer hydrates and a verifier re-folds from the entry alone.

use crate::bundle::CausalKey;
use crate::census::{Family, LegRole};
use crate::input::NodeKind;

/// One ranked target with the ranker's explanation of its place.
#[derive(Debug, Clone, PartialEq)]
pub struct FeedEntry {
    /// The target's CoGra id.
    pub target_id: String,
    /// The target's raw L1 identifier.
    pub target_graph_id: String,
    pub kind: NodeKind,
    /// `S(u, target)` — the signed greedy disjoint-sum (feed-ranking.md §6.1).
    pub score: f64,
    pub tie_breakers: TieBreakers,
    /// The extracted paths, strongest first — at most `k`.
    pub paths: Vec<RankPath>,
}

/// The tie-breaker cascade's inputs (feed-ranking.md §7). A statistic is
/// present exactly when the governed composition names it.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TieBreakers {
    pub net_stance: Option<f64>,
    pub gross_volume: Option<f64>,
    /// The epoch age of the target's genesis authorship record, for display:
    /// an update never refreshes it. The order reads the causal key itself.
    /// Absent for an authorless Type.
    pub genesis_epoch_age: Option<i64>,
}

/// One extracted path from the viewer to the target. Persons are one node,
/// under their profile identifier.
#[derive(Debug, Clone, PartialEq)]
pub struct RankPath {
    /// Viewer → … → target.
    pub nodes: Vec<String>,
    /// The folded hops traversed, one between each pair of nodes.
    pub hops: Vec<RankHop>,
    /// `σ(π)` — `+1` or `−1` (feed-ranking.md §5.2).
    pub sign: i32,
    /// `m(π) = ∏ γ·w̃` over the hops, left to right.
    pub magnitude: f64,
    /// `f(Δt)` of the path's terminal stance record.
    pub recency: f64,
    /// This path's term in `S`: `σ·m·f`.
    pub contribution: f64,
}

/// One folded hop — a bundle netted into an effective edge (feed-ranking.md
/// §3.2), with the raw members it folds over.
#[derive(Debug, Clone, PartialEq)]
pub struct RankHop {
    pub family: Family,
    pub role: LegRole,
    /// The bundle's author, a bare address atom.
    pub author: String,
    /// The hop's own endpoints, persons under their profile identifier.
    pub source: String,
    pub target: String,
    /// The member records, in ≺, each with this leg's parameters.
    pub members: Vec<HopMember>,
    /// The folded parameters `(p̄_d, p̄_i)`.
    pub p_directed: f64,
    pub p_interest: f64,
    /// The ≺-newest member's leg maturity.
    pub tau: f64,
    /// This hop's factor: `γ·w̃` of the folded leg.
    pub weight: f64,
}

/// One raw member record of a hop's bundle.
#[derive(Debug, Clone, PartialEq)]
pub struct HopMember {
    pub record_id: String,
    pub key: CausalKey,
    pub p_d: f64,
    pub p_i: f64,
    pub tau: f64,
}
