//! ´mod:module:input´
//!
//! Everything the ranker reads — and, by construction, nothing else.
//!
//! feed-ranking.md §2 names the computation's inputs exactly: the raw L1
//! edge records of the slice, the epoch certificates (here the slice's own
//! epoch, which every age is read against), the viewer's read-side state,
//! and the governed calibration parameters. The structs below carry those
//! and have no field that could carry anything else — no standing, no honor,
//! no money, no payload body, no session event (feed-ranking.md §2 "It never
//! reads"). T-NOAI pins the field lists.

use crate::bundle::CausalKey;
use crate::census::{Family, LegRole};
use crate::recency::RecencyShape;

/// A rankable node's kind — the api's `NodeKind`, verbatim.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum NodeKind {
    User,
    Collective,
    Post,
    Comment,
    Chat,
    ChatMessage,
    Item,
    Hashtag,
    Proposal,
    Campaign,
    Offer,
}

impl NodeKind {
    pub const ALL: [NodeKind; 11] = [
        NodeKind::User,
        NodeKind::Collective,
        NodeKind::Post,
        NodeKind::Comment,
        NodeKind::Chat,
        NodeKind::ChatMessage,
        NodeKind::Item,
        NodeKind::Hashtag,
        NodeKind::Proposal,
        NodeKind::Campaign,
        NodeKind::Offer,
    ];

    /// The kind's token on the api's wire (`NodeKind`, schema.graphql).
    pub fn wire_name(self) -> &'static str {
        match self {
            NodeKind::User => "USER",
            NodeKind::Collective => "COLLECTIVE",
            NodeKind::Post => "POST",
            NodeKind::Comment => "COMMENT",
            NodeKind::Chat => "CHAT",
            NodeKind::ChatMessage => "CHAT_MESSAGE",
            NodeKind::Item => "ITEM",
            NodeKind::Hashtag => "HASHTAG",
            NodeKind::Proposal => "PROPOSAL",
            NodeKind::Campaign => "CAMPAIGN",
            NodeKind::Offer => "OFFER",
        }
    }

    /// The kind a wire token names, if any.
    pub fn from_wire(token: &str) -> Option<NodeKind> {
        NodeKind::ALL.into_iter().find(|k| k.wire_name() == token)
    }
}

/// The viewer's slice: the `χ`-bounded node set and the accepted records
/// among it (miner-api.md "The contract"), read as of one epoch.
#[derive(Debug, Clone, PartialEq)]
pub struct Slice {
    /// The newest epoch whose certificate the slice includes — the base of
    /// every epoch age (feed-ranking.md §5.3).
    pub as_of_epoch: i64,
    /// The viewer whose slice this is, by CoGra id: the node whose `id` this
    /// is roots every path.
    pub viewer: String,
    pub nodes: Vec<SliceNode>,
    pub records: Vec<SliceRecord>,
}

/// One node of the slice, keyed by its raw L1 identifier.
#[derive(Debug, Clone, PartialEq)]
pub struct SliceNode {
    /// The raw L1 identifier: `prof:<a>` for a person, `name:<s>` for a
    /// Type, `mint:<act>` for minted content. An `addr:<a>` names the same
    /// person as `prof:<a>` (feed-ranking.md §4 "Persons are one node").
    pub graph_id: String,
    /// CoGra's id for the node, when CoGra carries a row for it. A node
    /// without one transits and is never a candidate.
    pub id: Option<String>,
    /// The node's kind, present exactly when `id` is.
    pub kind: Option<NodeKind>,
    /// The node's genesis authorship record's place in ≺ — the recency
    /// tie-breaker's key, never refreshed by an update (feed-ranking.md §7).
    /// Absent for an authorless node, a Type.
    pub genesis: Option<CausalKey>,
    /// The global tie-breaker statistics toward this node, computed at the
    /// mirror and shipped per candidate — present only when the governed
    /// composition names a statistic (zero bytes at the genesis seed).
    pub statistics: Option<TieStatistics>,
}

/// The two global statistics of feed-ranking.md §7, toward one target.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TieStatistics {
    /// `Σ_a f(Δt_a)·(p̄_d + p̄_i)` over the folded bundles toward the target.
    pub net_stance: f64,
    /// `Σ_a f(Δt_a)·(|p̄_d| + |p̄_i|)`.
    pub gross_volume: f64,
}

/// One accepted L1 record, raw.
#[derive(Debug, Clone, PartialEq)]
pub struct SliceRecord {
    /// L1's record identifier, verbatim (`act:<author>:<seq>:<family>`).
    pub record_id: String,
    pub family: Family,
    /// The authoring actor's bare address atom; the author's person node is
    /// `prof:<author>`.
    pub author: String,
    /// The record's place in ≺.
    pub key: CausalKey,
    /// Every leg of the act as Layer 1 published it.
    pub legs: Vec<SliceLeg>,
}

/// One leg of a record, with the leg's own rendering of the act's
/// parameters and its maturity.
#[derive(Debug, Clone, PartialEq)]
pub struct SliceLeg {
    pub role: LegRole,
    pub source: String,
    pub target: String,
    pub p_d: f64,
    pub p_i: f64,
    /// τ_e — the host-cached edge-projection maturity, frozen at landing.
    pub tau: f64,
    /// Ingestion had no census row for this leg and wrote fallback
    /// metadata. Every fold skips such a leg (api-spec `RecordLeg`).
    pub census_unknown: bool,
}

/// One named key of the governed tie-breaker composition (feed-ranking.md
/// §7; network.md "Feed-ranking calibration"). The composition is an
/// ordered list of these, never weights.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum TieBreakerKey {
    /// Net stance, higher first.
    NetStance,
    /// Gross volume, higher first.
    GrossVolume,
    /// Genesis recency: the target's genesis authorship record by its
    /// causal key, newest first.
    Recency,
}

impl TieBreakerKey {
    /// The key's name in the governed `tie_breaker_composition` value.
    pub fn parameter_name(self) -> &'static str {
        match self {
            TieBreakerKey::NetStance => "net_stance",
            TieBreakerKey::GrossVolume => "gross_volume",
            TieBreakerKey::Recency => "recency",
        }
    }

    /// The key a composition entry names, if it is one of the three.
    pub fn from_parameter(name: &str) -> Option<TieBreakerKey> {
        [
            TieBreakerKey::NetStance,
            TieBreakerKey::GrossVolume,
            TieBreakerKey::Recency,
        ]
        .into_iter()
        .find(|k| k.parameter_name() == name)
    }
}

/// The governed calibration parameters (feed-ranking.md §12), as the
/// published network parameters carry them. The runner reads them from
/// published state, never from the request (miner-api.md "Inputs").
#[derive(Debug, Clone, PartialEq)]
pub struct NetworkParams {
    /// Disjoint paths extracted per (viewer, target).
    pub k: u32,
    /// `γ`, the network default.
    pub gamma: f64,
    /// `χ`, the network dust floor.
    pub dust_floor: f64,
    /// The network half-life of `f(Δt)`, in epochs.
    pub half_life_epochs: u32,
    pub shape: RecencyShape,
    /// The ordered tie-breaker composition.
    pub tie_breakers: Vec<TieBreakerKey>,
}

/// The viewer's ranking parameters (miner-api.md `RankParams`): the
/// candidate narrowing and the three calibration overrides. `None` falls
/// back to the network default.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct RankParams {
    /// Rankable kinds in scope; `None` means Posts only, an empty list
    /// ranks nothing.
    pub kinds: Option<Vec<NodeKind>>,
    /// A Type's CoGra id: only content reaching the viewer over Tag records
    /// toward it is a candidate (hashtag.md §5).
    pub topic: Option<String>,
    /// `γ` in `(0, 1]`.
    pub gamma: Option<f64>,
    /// `χ`, finer than or equal to the network's.
    pub dust_floor: Option<f64>,
    /// The half-life in epochs; `0` disables recency.
    pub half_life_epochs: Option<i64>,
    /// Content ids excluded from the candidate set before ranking
    /// (feed-ranking.md §9.4). A seen node still transits.
    pub seen: Vec<String>,
}
