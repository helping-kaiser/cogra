//! ´mod:module:graph´
//!
//! The traversal graph: the slice validated, its records folded into
//! bundles, every live folded leg turned into a hop, and the hops wired into
//! edges by feed-ranking.md §4's traversal policy.
//!
//! - **Persons are one node.** `addr:a` and `prof:a` are read as `prof:a`.
//! - **Forward only.** A hop runs from its leg's source to its target.
//! - **The fold** keys a bundle by its full incidence — author, family,
//!   source, middle (hyper-edges only) and semantic target — and folds each
//!   leg of it separately (feed-ranking.md §3.2; layer1-interface.md §11.3).
//!   Bid, Accept and Ratify are read per record. Registration is internal to
//!   the person and never a transit hop; the control records are never
//!   traversed; a census-unknown leg is never folded.
//! - **Zero is inert.** A leg whose folded pair is inert, or whose factor
//!   `γ·w̃` is zero, is no hop.
//! - **Types are sinks.** No hop leaves a Type.
//! - **Channel gates.** The T-leg of a Reference or a Tag crosses when its
//!   author created the carrier (content-intrinsic); that of a Review when
//!   its author created the Comment it targets. Otherwise it crosses only as
//!   the continuation of the bundle's own A-leg (initiator-owned), which is
//!   wired as one composite edge from the author through the carrier. The
//!   carrier is still a node of the path, so disjointness sees it.
//!
//! Every hop is identified by its key, the bundle's full-incidence key and
//! the leg role (RC-G2 (a)); per-record hops add the record id. Hops are
//! numbered in key order, so comparing two hop-number sequences is comparing
//! their key sequences lexicographically — the canonical tie-break of
//! feed-ranking.md §6.1.

use std::collections::{BTreeMap, BTreeSet};

use common::l1::census::Family as SeamFamily;
use common::l1::identifier::NodeId;

use crate::bundle::{CausalKey, Folded, Member, fold_members};
use crate::census::{Family, LegRole};
use crate::error::RankError;
use crate::input::{NodeKind, Slice, SliceLeg, TieStatistics};
use crate::output::HopMember;
use crate::weight::damped_weight;

/// A person's two identifiers are one node; every other identifier is its
/// own.
pub(crate) fn canonical(id: &str) -> String {
    match id.strip_prefix("addr:") {
        Some(atom) => format!("prof:{atom}"),
        None => id.to_string(),
    }
}

/// A record's author as a person node.
pub(crate) fn person(atom: &str) -> String {
    format!("prof:{atom}")
}

/// Who created a node, read syntactically off its identifier: a person
/// created their own profile, a minted node names its genesis act and so its
/// author. A Type and a Chat have no single author (feed-ranking.md §4
/// "References").
pub(crate) fn creator(graph_id: &str) -> Option<String> {
    match NodeId::parse(graph_id).ok()? {
        NodeId::Prof(atom) | NodeId::Addr(atom) => Some(atom),
        NodeId::Mint(act) if act.family != SeamFamily::Participant => Some(act.author),
        NodeId::Mint(_) | NodeId::Name(_) => None,
    }
}

pub(crate) fn is_type(graph_id: &str) -> bool {
    graph_id.starts_with("name:")
}

/// One node of the graph.
#[derive(Debug, Clone)]
pub(crate) struct Node {
    pub graph_id: String,
    pub id: Option<String>,
    pub kind: Option<NodeKind>,
    pub genesis: Option<CausalKey>,
    pub statistics: Option<TieStatistics>,
}

/// A bundle's identity: its full incidence, plus the record id for the
/// families read per record.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) struct BundleKey {
    pub author: String,
    pub family: String,
    pub source: String,
    pub middle: String,
    pub target: String,
    pub record: String,
}

/// A folded leg's identity: the bundle's key and the leg's role — the
/// canonical tie key of a hop (RC-G2 (a)).
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) struct HopKey {
    pub bundle: BundleKey,
    pub role: String,
}

/// One live folded leg.
#[derive(Debug, Clone)]
pub(crate) struct Hop {
    pub key: HopKey,
    pub family: Family,
    pub role: LegRole,
    pub author: String,
    pub source: usize,
    pub target: usize,
    pub members: Vec<HopMember>,
    pub folded: Folded,
    pub tau: f64,
    /// `γ·w̃`.
    pub factor: f64,
    /// `−ln(γ·w̃)`.
    pub cost: f64,
}

/// One traversal edge: a single hop, or the composite A·T crossing of an
/// initiator-owned channel, which passes through the carrier `via`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) struct Edge {
    pub first: usize,
    pub second: Option<usize>,
    pub via: Option<usize>,
    pub to: usize,
}

/// One record as validated: its legs keyed by role, endpoints canonical.
#[derive(Debug, Clone)]
pub(crate) struct Record {
    pub record_id: String,
    pub family: Family,
    pub author: String,
    pub key: CausalKey,
    pub source: String,
    pub middle: Option<String>,
    pub target: String,
    pub legs: BTreeMap<LegRole, Leg>,
}

/// One leg as validated.
#[derive(Debug, Clone)]
pub(crate) struct Leg {
    pub source: String,
    pub target: String,
    pub p_d: f64,
    pub p_i: f64,
    pub tau: f64,
    pub census_unknown: bool,
}

/// The validated slice and its traversal graph at one `γ`.
#[derive(Debug, Clone)]
pub(crate) struct Graph {
    pub as_of_epoch: i64,
    pub nodes: Vec<Node>,
    pub index: BTreeMap<String, usize>,
    pub root: usize,
    pub records: Vec<Record>,
    pub hops: Vec<Hop>,
    /// Out-edges per node, in canonical order.
    pub out: Vec<Vec<Edge>>,
    /// The nodes with an edge into each node — the reverse walk that finds
    /// every node able to reach a candidate.
    pub into: Vec<Vec<usize>>,
}

/// What the traversal does with a family (feed-ranking.md §4).
enum Treatment {
    Folded,
    PerRecord,
    Skipped,
}

fn treatment(record_id: &str, family: Family) -> Result<Treatment, RankError> {
    match family {
        Family::Publish
        | Family::Opinion
        | Family::Affinity
        | Family::Owner
        | Family::JoinRequest
        | Family::Tag
        | Family::Review
        | Family::Send
        | Family::Reference => Ok(Treatment::Folded),
        Family::Bid | Family::Accept | Family::Ratify => Ok(Treatment::PerRecord),
        Family::Registration | Family::Withdraw | Family::Rescind | Family::Leave => {
            Ok(Treatment::Skipped)
        }
        Family::Participant | Family::Invitation | Family::DeInvite => {
            Err(RankError::UnsupportedFamily {
                record_id: record_id.to_string(),
                family,
            })
        }
    }
}

/// Whether a T-leg is channel-gated, and if so whether the
/// content-intrinsic channel opens it.
fn gate(record: &Record) -> Option<bool> {
    let middle = record.middle.as_deref()?;
    match record.family {
        Family::Reference | Family::Tag => {
            Some(creator(middle).as_deref() == Some(record.author.as_str()))
        }
        Family::Review => Some(creator(&record.target).as_deref() == Some(record.author.as_str())),
        _ => None,
    }
}

fn check_leg(record_id: &str, leg: &SliceLeg) -> Result<(), RankError> {
    for (name, value) in [("p_d", leg.p_d), ("p_i", leg.p_i)] {
        if !(-1.0..=1.0).contains(&value) {
            return Err(RankError::malformed(format!(
                "record {record_id} carries {name} = {value} outside [-1, 1]"
            )));
        }
    }
    if !(0.0..=1.0).contains(&leg.tau) {
        return Err(RankError::malformed(format!(
            "record {record_id} carries τ = {} outside [0, 1]",
            leg.tau
        )));
    }
    Ok(())
}

fn validate_nodes(slice: &Slice) -> Result<(Vec<Node>, BTreeMap<String, usize>), RankError> {
    let mut by_id: BTreeMap<String, Node> = BTreeMap::new();
    for node in &slice.nodes {
        let graph_id = canonical(&node.graph_id);
        if node.id.is_some() != node.kind.is_some() {
            return Err(RankError::malformed(format!(
                "node {graph_id} carries an id without a kind, or a kind without an id"
            )));
        }
        let previous = by_id.insert(
            graph_id.clone(),
            Node {
                graph_id: graph_id.clone(),
                id: node.id.clone(),
                kind: node.kind,
                genesis: node.genesis,
                statistics: node.statistics,
            },
        );
        if previous.is_some() {
            return Err(RankError::malformed(format!(
                "node {graph_id} is listed twice"
            )));
        }
    }
    let nodes: Vec<Node> = by_id.into_values().collect();
    let index = nodes
        .iter()
        .enumerate()
        .map(|(i, n)| (n.graph_id.clone(), i))
        .collect();
    Ok((nodes, index))
}

fn validate_record(
    record: &crate::input::SliceRecord,
    index: &BTreeMap<String, usize>,
) -> Result<Record, RankError> {
    let id = &record.record_id;
    let roles = record.family.roles();
    let mut legs: BTreeMap<LegRole, Leg> = BTreeMap::new();
    for leg in &record.legs {
        check_leg(id, leg)?;
        let (source, target) = (canonical(&leg.source), canonical(&leg.target));
        for end in [&source, &target] {
            if !index.contains_key(end) {
                return Err(RankError::malformed(format!(
                    "record {id} names {end}, which is not a node of the slice"
                )));
            }
        }
        if !leg.census_unknown && !roles.contains(&leg.role) {
            return Err(RankError::malformed(format!(
                "record {id} is a {} record with a {} leg",
                record.family, leg.role
            )));
        }
        let previous = legs.insert(
            leg.role,
            Leg {
                source,
                target,
                p_d: leg.p_d,
                p_i: leg.p_i,
                tau: leg.tau,
                census_unknown: leg.census_unknown,
            },
        );
        if previous.is_some() {
            return Err(RankError::malformed(format!(
                "record {id} carries its {} leg twice",
                leg.role
            )));
        }
    }
    let author_node = person(&record.author);
    let (source, middle, target) = match (
        legs.get(&LegRole::Binary),
        legs.get(&LegRole::A),
        legs.get(&LegRole::T),
    ) {
        (Some(binary), None, None) => (binary.source.clone(), None, binary.target.clone()),
        (None, Some(a), Some(t)) if a.target == t.source => {
            (a.source.clone(), Some(a.target.clone()), t.target.clone())
        }
        _ => {
            return Err(RankError::malformed(format!(
                "record {id} does not carry one binary leg or a matched A and T leg"
            )));
        }
    };
    if source != author_node {
        return Err(RankError::malformed(format!(
            "record {id} starts at {source}, not at its author {author_node}"
        )));
    }
    Ok(Record {
        record_id: id.clone(),
        family: record.family,
        author: record.author.clone(),
        key: record.key,
        source,
        middle,
        target,
        legs,
    })
}

/// A slice that passed validation.
pub(crate) struct Validated {
    pub nodes: Vec<Node>,
    pub index: BTreeMap<String, usize>,
    pub root: usize,
    pub records: Vec<Record>,
}

/// Validates the slice: nodes once each, records once each and one per
/// causal key, every leg's ends in the node set, every leg in its family's
/// census, every parameter in range, and the viewer present as a person.
pub(crate) fn validate(slice: &Slice) -> Result<Validated, RankError> {
    let (nodes, index) = validate_nodes(slice)?;
    let root = nodes
        .iter()
        .position(|n| n.id.as_deref() == Some(slice.viewer.as_str()))
        .ok_or_else(|| RankError::malformed("the viewer is not a node of its own slice"))?;
    if !nodes[root].graph_id.starts_with("prof:") {
        return Err(RankError::malformed("the viewer's node is not a person"));
    }
    let mut ids = BTreeSet::new();
    let mut keys = BTreeSet::new();
    let mut records = Vec::with_capacity(slice.records.len());
    for record in &slice.records {
        if !ids.insert(record.record_id.clone()) {
            return Err(RankError::malformed(format!(
                "record {} is listed twice",
                record.record_id
            )));
        }
        if !keys.insert(record.key) {
            return Err(RankError::malformed(format!(
                "two records claim the causal key {:?}",
                record.key
            )));
        }
        treatment(&record.record_id, record.family)?;
        records.push(validate_record(record, &index)?);
    }
    records.sort_by_key(|r| r.key);
    Ok(Validated {
        nodes,
        index,
        root,
        records,
    })
}

impl Graph {
    /// Builds the traversal graph at `gamma`.
    pub(crate) fn build(slice: &Slice, gamma: f64) -> Result<Graph, RankError> {
        let Validated {
            nodes,
            index,
            root,
            records,
        } = validate(slice)?;
        let mut bundles: BTreeMap<HopKey, (Family, LegRole, String, Vec<HopMember>)> =
            BTreeMap::new();
        let mut gates: BTreeMap<BundleKey, bool> = BTreeMap::new();
        for record in &records {
            let per_record = match treatment(&record.record_id, record.family)? {
                Treatment::Skipped => continue,
                Treatment::Folded => false,
                Treatment::PerRecord => true,
            };
            let bundle = BundleKey {
                author: record.author.clone(),
                family: record.family.wire_name().to_string(),
                source: record.source.clone(),
                middle: record.middle.clone().unwrap_or_default(),
                target: record.target.clone(),
                record: if per_record {
                    record.record_id.clone()
                } else {
                    String::new()
                },
            };
            if let Some(intrinsic) = gate(record) {
                gates.insert(bundle.clone(), intrinsic);
            }
            for (role, leg) in &record.legs {
                if leg.census_unknown {
                    continue;
                }
                let key = HopKey {
                    bundle: bundle.clone(),
                    role: role.wire_name().to_string(),
                };
                bundles
                    .entry(key)
                    .or_insert_with(|| (record.family, *role, record.author.clone(), Vec::new()))
                    .3
                    .push(HopMember {
                        record_id: record.record_id.clone(),
                        key: record.key,
                        p_d: leg.p_d,
                        p_i: leg.p_i,
                        tau: leg.tau,
                    });
            }
        }

        let mut hops = Vec::new();
        for (key, (family, role, author, members)) in bundles {
            let (source, target) = match role {
                LegRole::Binary => (key.bundle.source.clone(), key.bundle.target.clone()),
                LegRole::A => (key.bundle.source.clone(), key.bundle.middle.clone()),
                LegRole::T => (key.bundle.middle.clone(), key.bundle.target.clone()),
            };
            if source == target || is_type(&source) {
                continue;
            }
            let folded = fold_members(
                &members
                    .iter()
                    .map(|m| Member {
                        key: m.key,
                        p_d: m.p_d,
                        p_i: m.p_i,
                    })
                    .collect::<Vec<_>>(),
            )?;
            if folded.is_inert() {
                continue;
            }
            let tau = members
                .iter()
                .find(|m| m.key == folded.newest)
                .map(|m| m.tau)
                .ok_or_else(|| RankError::malformed("a folded bundle lost its newest member"))?;
            let w = damped_weight(family, role, folded.p_d, folded.p_i, tau)?;
            let factor = gamma * w;
            if factor.is_nan() || factor <= 0.0 {
                continue;
            }
            let (Some(&s), Some(&t)) = (index.get(&source), index.get(&target)) else {
                return Err(RankError::malformed("a hop's ends left the node set"));
            };
            hops.push(Hop {
                key,
                family,
                role,
                author,
                source: s,
                target: t,
                members,
                folded,
                tau,
                factor,
                cost: -libm::log(factor),
            });
        }

        let by_key: BTreeMap<HopKey, usize> = hops
            .iter()
            .enumerate()
            .map(|(i, h)| (h.key.clone(), i))
            .collect();
        let mut out: Vec<Vec<Edge>> = vec![Vec::new(); nodes.len()];
        for (i, hop) in hops.iter().enumerate() {
            let gated = if hop.role == LegRole::T {
                gates.get(&hop.key.bundle).copied()
            } else {
                None
            };
            match gated {
                None | Some(true) => out[hop.source].push(Edge {
                    first: i,
                    second: None,
                    via: None,
                    to: hop.target,
                }),
                Some(false) => {
                    let a_key = HopKey {
                        bundle: hop.key.bundle.clone(),
                        role: LegRole::A.wire_name().to_string(),
                    };
                    if let Some(&a) = by_key.get(&a_key) {
                        out[hops[a].source].push(Edge {
                            first: a,
                            second: Some(i),
                            via: Some(hop.source),
                            to: hop.target,
                        });
                    }
                }
            }
        }
        for edges in &mut out {
            edges.sort();
        }
        let mut into: Vec<Vec<usize>> = vec![Vec::new(); nodes.len()];
        for (from, edges) in out.iter().enumerate() {
            for edge in edges {
                into[edge.to].push(from);
            }
        }
        for sources in &mut into {
            sources.sort_unstable();
            sources.dedup();
        }
        Ok(Graph {
            as_of_epoch: slice.as_of_epoch,
            nodes,
            index,
            root,
            records,
            hops,
            out,
            into,
        })
    }

    /// Every node with a walk to `target`, `target` included.
    pub(crate) fn ancestors(&self, target: usize) -> Vec<bool> {
        let mut seen = vec![false; self.nodes.len()];
        let mut stack = vec![target];
        seen[target] = true;
        while let Some(node) = stack.pop() {
            for &from in &self.into[node] {
                if !seen[from] {
                    seen[from] = true;
                    stack.push(from);
                }
            }
        }
        seen
    }
}
