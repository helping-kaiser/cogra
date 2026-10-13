//! ´mod:module:view´
//!
//! What the server's ranker pod answers beside the neutral rank, all of it
//! pure functions of the pinned slice (ranked-feed-api §4.10, §5.4; PR-49):
//! the people mark on every row, the NEWEST permutation, and the places of
//! the still-settling rows in both woven orders. None of it re-orders the
//! entries, which stay exactly the neutral rank.
//!
//! - **The mark** (OS-18 S1) is the viewer's own current folded Opinion →
//!   Profile bundle toward the row's person: `FOR` for `p̄_d > 0`, `AGAINST`
//!   for `p̄_d < 0`, `SIGNLESS` for `(0, ≠0)`, none for `(0, 0)` or no
//!   bundle. A Post or Comment row's person is its genesis author, a
//!   profile row's its own person; a Tags row has none.
//! - **NEWEST** orders the entries by their target's genesis causal key,
//!   newest first; a Type, having none, after every dated target in its
//!   RANKED order.
//! - **The settling key** (PR-36) is `S(u, prof(author)) × φ`: the viewer's
//!   reach to the author times the factor the pending record's own
//!   authorship legs will carry when it lands — `γ·w̃` per leg at its
//!   family's census row, at landing maturity `τ = 0` and age `0`. The
//!   viewer's own pending content reaches them over the empty walk, whose
//!   product is `1`. A candidate whose author no live walk reaches is
//!   unkeyed and gets no place (OS-10).
//! - **RANKED weave** (W-2): a keyed row stands directly after the last
//!   entry scoring at least its key — ties go to the landed row; rows in
//!   one gap order by key, then newest authoring instant, then reference.
//! - **NEWEST weave** (W-3, OS-17): every settling row ahead of every
//!   landed row, newest authoring instant first, then reference.

use std::cmp::Ordering;
use std::collections::BTreeSet;

use common::l1::census::leg_params;

use crate::bundle::{Member, fold_members};
use crate::census::{Family, LegRole};
use crate::error::RankError;
use crate::extract::{Residual, dijkstra, extract, walk_to};
use crate::graph::{Graph, creator, person};
use crate::input::{NetworkParams, NodeKind, RankParams, Slice};
use crate::output::FeedEntry;
use crate::rank::{Calibration, calibrate, feed_candidates, newest_first, path_of, rank_nodes};
use crate::weight::damped_weight;

/// How the viewer holds the person behind a row.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum PeopleMark {
    For,
    Against,
    Signless,
}

impl PeopleMark {
    /// The mark's token on the pod's wire.
    pub fn wire_name(self) -> &'static str {
        match self {
            PeopleMark::For => "FOR",
            PeopleMark::Against => "AGAINST",
            PeopleMark::Signless => "SIGNLESS",
        }
    }
}

/// A piece of content still settling, with the one authorship record it
/// was born with (ranked-feed-api §4.10).
#[derive(Debug, Clone, PartialEq)]
pub struct SettlingCandidate {
    /// CoGra's id for the content; echoed, never read.
    pub reference: String,
    /// The author's person node, `prof:<atom>`.
    pub author: String,
    /// The authorship record's family.
    pub family: Family,
    /// The authorship record's own authored parameters.
    pub p_d: f64,
    pub p_i: f64,
    /// The authoring instant, in any monotone integer unit — microseconds
    /// since the Unix epoch on the pod's wire. Only ever compared with
    /// other authoring instants.
    pub authored_at: i64,
}

/// One landed entry with its mark and its NEWEST place.
#[derive(Debug, Clone, PartialEq)]
pub struct RankedEntry {
    pub entry: FeedEntry,
    pub mark: Option<PeopleMark>,
    /// The entry's 0-based index among the entries in NEWEST order.
    pub newest_index: u32,
}

/// One placed settling row.
#[derive(Debug, Clone, PartialEq)]
pub struct SettlingPlace {
    pub reference: String,
    pub mark: Option<PeopleMark>,
    /// Its 0-based index in the woven RANKED list.
    pub ranked_position: u32,
    /// Its 0-based index in the woven NEWEST list.
    pub newest_position: u32,
}

/// One ranking snapshot, as the pod answers it.
#[derive(Debug, Clone, PartialEq)]
pub struct FeedRanking {
    pub as_of_epoch: i64,
    /// The neutral rank, best first.
    pub entries: Vec<RankedEntry>,
    pub settling: Vec<SettlingPlace>,
}

/// The viewer's current folded Opinion → Profile bundle toward `person`,
/// read as a mark.
pub(crate) fn mark(g: &Graph, person_node: &str) -> Result<Option<PeopleMark>, RankError> {
    let viewer = &g.nodes[g.root].graph_id;
    let viewer_atom = viewer.trim_start_matches("prof:");
    let members: Vec<Member> = g
        .records
        .iter()
        .filter(|r| {
            r.family == Family::Opinion && r.author == viewer_atom && r.target == person_node
        })
        .filter_map(|r| {
            r.legs
                .get(&LegRole::Binary)
                .filter(|leg| !leg.census_unknown)
                .map(|leg| Member {
                    key: r.key,
                    p_d: leg.p_d,
                    p_i: leg.p_i,
                })
        })
        .collect();
    if members.is_empty() {
        return Ok(None);
    }
    let folded = fold_members(&members)?;
    Ok(if folded.p_d > 0.0 {
        Some(PeopleMark::For)
    } else if folded.p_d < 0.0 {
        Some(PeopleMark::Against)
    } else if folded.p_i != 0.0 {
        Some(PeopleMark::Signless)
    } else {
        None
    })
}

/// The person behind a row: a profile's own person, content's genesis
/// author; a Tags row has none.
pub(crate) fn row_person(graph_id: &str, kind: NodeKind) -> Option<String> {
    if kind == NodeKind::Hashtag {
        return None;
    }
    creator(graph_id).map(|atom| person(&atom))
}

/// `S(u, node)` for any node, or `None` when no live walk reaches it.
fn strength(
    g: &Graph,
    node: usize,
    cal: &Calibration,
    first: Option<crate::extract::Walk>,
) -> Option<f64> {
    if node == g.root {
        return Some(1.0);
    }
    let walks = extract(g, node, first, cal.k, cal.chi);
    if walks.is_empty() {
        return None;
    }
    Some(
        walks
            .iter()
            .map(|w| path_of(g, w, cal.half_life).contribution)
            .fold(0.0, |s, c| s + c),
    )
}

fn bad(field: &str, reason: &str) -> RankError {
    RankError::BadInput {
        field: field.to_string(),
        reason: reason.to_string(),
    }
}

/// `φ`: the factor a pending authorship record's legs carry once landed.
fn landing_factor(candidate: &SettlingCandidate, cal: &Calibration) -> Result<f64, RankError> {
    for value in [candidate.p_d, candidate.p_i] {
        if !(-1.0..=1.0).contains(&value) {
            return Err(bad("settling", "a parameter lies outside [-1, 1]"));
        }
    }
    match candidate.family {
        Family::Publish
        | Family::Opinion
        | Family::Affinity
        | Family::Owner
        | Family::JoinRequest
        | Family::Tag
        | Family::Review
        | Family::Send
        | Family::Reference
        | Family::Bid
        | Family::Accept
        | Family::Ratify => {}
        _ => {
            return Err(bad(
                "settling",
                "the family carries no authorship edge the feed walks",
            ));
        }
    }
    let mut factor = 1.0;
    for role in candidate.family.roles() {
        let seam_role = match role {
            LegRole::Binary => common::l1::census::LegRole::Binary,
            LegRole::A => common::l1::census::LegRole::A,
            LegRole::T => common::l1::census::LegRole::T,
        };
        let (p_d, p_i) = leg_params(seam_role, candidate.p_d, candidate.p_i);
        factor *= cal.gamma * damped_weight(candidate.family, role, p_d, p_i, 0.0)?;
    }
    Ok(factor)
}

/// The NEWEST permutation: for each entry in RANKED order, its index in
/// NEWEST order.
fn newest_indices(g: &Graph, entries: &[FeedEntry]) -> Vec<u32> {
    let mut order: Vec<usize> = (0..entries.len()).collect();
    order.sort_by(|&a, &b| {
        newest_first(g, &entries[a].target_graph_id, &entries[b].target_graph_id)
            .then_with(|| a.cmp(&b))
    });
    let mut index = vec![0u32; entries.len()];
    for (place, &entry) in order.iter().enumerate() {
        index[entry] = place as u32;
    }
    index
}

struct Keyed<'a> {
    candidate: &'a SettlingCandidate,
    key: f64,
    gap: usize,
}

fn by_instant_then_reference(a: &SettlingCandidate, b: &SettlingCandidate) -> Ordering {
    b.authored_at
        .cmp(&a.authored_at)
        .then_with(|| a.reference.cmp(&b.reference))
}

/// The pod's answer: the neutral rank of `rank`, each entry marked and
/// placed in NEWEST order, and the settling candidates woven into both.
pub fn feed_ranking(
    slice: &Slice,
    params: &RankParams,
    net: &NetworkParams,
    settling: &[SettlingCandidate],
) -> Result<FeedRanking, RankError> {
    let cal = calibrate(params, net)?;
    let g = Graph::build(slice, cal.gamma)?;
    let candidates = feed_candidates(&g, params, &cal)?;
    let entries = rank_nodes(&g, &candidates, &cal)?;
    assemble(&g, &cal, entries, settling)
}

/// The search re-ranking in the pod's answer shape: the in-slice subset of
/// `candidates` a live path reaches, ordered, marked and placed in NEWEST
/// order among themselves. No settling rows: search candidates are given.
pub fn search_ranking(
    slice: &Slice,
    candidates: &[String],
    params: &RankParams,
    net: &NetworkParams,
) -> Result<FeedRanking, RankError> {
    let cal = calibrate(params, net)?;
    let g = Graph::build(slice, cal.gamma)?;
    let entries = crate::rank::rank_search_nodes(&g, candidates, &cal)?;
    assemble(&g, &cal, entries, &[])
}

/// Marks the ranked entries, places them in NEWEST order, and weaves the
/// settling candidates into both orders.
fn assemble(
    g: &Graph,
    cal: &Calibration,
    entries: Vec<FeedEntry>,
    settling: &[SettlingCandidate],
) -> Result<FeedRanking, RankError> {
    let newest = newest_indices(g, &entries);
    let mut ranked = Vec::with_capacity(entries.len());
    for (entry, newest_index) in entries.iter().zip(newest) {
        let mark = match row_person(&entry.target_graph_id, entry.kind) {
            Some(p) => mark(g, &p)?,
            None => None,
        };
        ranked.push(RankedEntry {
            entry: entry.clone(),
            mark,
            newest_index,
        });
    }

    let landed: BTreeSet<&str> = entries.iter().map(|e| e.target_id.as_str()).collect();
    let mut references = BTreeSet::new();
    for candidate in settling {
        if !references.insert(candidate.reference.as_str()) {
            return Err(bad("settling", "a reference is repeated"));
        }
    }
    let tree = dijkstra(
        g,
        &Residual {
            allowed: None,
            blocked: &vec![false; g.nodes.len()],
            direct_spent: None,
        },
        None,
    );
    let mut keyed = Vec::new();
    for candidate in settling {
        let factor = landing_factor(candidate, cal)?;
        if landed.contains(candidate.reference.as_str()) {
            continue;
        }
        let Some(&author) = g.index.get(&candidate.author) else {
            continue;
        };
        let Some(reach) = strength(g, author, cal, walk_to(&tree, author)) else {
            continue;
        };
        let key = reach * factor;
        let gap = entries.iter().take_while(|e| e.score >= key).count();
        keyed.push(Keyed {
            candidate,
            key,
            gap,
        });
    }
    keyed.sort_by(|a, b| {
        a.gap
            .cmp(&b.gap)
            .then_with(|| b.key.total_cmp(&a.key))
            .then_with(|| by_instant_then_reference(a.candidate, b.candidate))
    });
    let ranked_position: Vec<u32> = keyed
        .iter()
        .enumerate()
        .map(|(earlier_rows, row)| (row.gap + earlier_rows) as u32)
        .collect();
    let mut newest_order: Vec<usize> = (0..keyed.len()).collect();
    newest_order
        .sort_by(|&a, &b| by_instant_then_reference(keyed[a].candidate, keyed[b].candidate));
    let mut newest_position = vec![0u32; keyed.len()];
    for (place, &row) in newest_order.iter().enumerate() {
        newest_position[row] = place as u32;
    }
    let mut places = Vec::with_capacity(keyed.len());
    for (i, row) in keyed.iter().enumerate() {
        places.push(SettlingPlace {
            reference: row.candidate.reference.clone(),
            mark: mark(g, &row.candidate.author)?,
            ranked_position: ranked_position[i],
            newest_position: newest_position[i],
        });
    }
    Ok(FeedRanking {
        as_of_epoch: g.as_of_epoch,
        entries: ranked,
        settling: places,
    })
}
