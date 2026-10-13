//! ´mod:module:rank´
//!
//! `S(u,c)` per candidate, and the sort (feed-ranking.md §5–§7):
//!
//! ```text
//! S(u,c) = Σ_{i=1..k} σ(π_i)·m(π_i)·f(Δt_{π_i})        in extraction order
//! σ(π)   = +1 iff ∏ sgn(p̄_d) = +1 and no hop has p̄_i < 0, else −1
//! f(Δt)  = 2^(−Δt / half-life) on the path's terminal hop only
//! ```
//!
//! Sort `S` descending; an unreachable candidate is absent, never zero. On
//! strict `S` equality the governed composition decides, key by key, and
//! never by weights. Recency is the target's genesis authorship record read
//! by its causal key, newest first, which an update never refreshes; it is
//! total over dated targets. A Type has no genesis record, so it sorts after
//! every dated target it ties with, and two that still tie fall back to
//! their identifiers' bytes — a totality backstop the composition never
//! reaches between dated targets.

use std::cmp::Ordering;
use std::collections::BTreeSet;

use crate::error::RankError;
use crate::extract::{Residual, Walk, dijkstra, extract, walk_to};
use crate::graph::Graph;
use crate::input::{NetworkParams, NodeKind, RankParams, Slice, TieBreakerKey};
use crate::output::{FeedEntry, RankHop, RankPath, TieBreakers};
use crate::recency::{epoch_age, recency_factor};

/// The parameters one ranking runs under, defaults resolved.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Calibration {
    pub k: u32,
    pub gamma: f64,
    pub chi: f64,
    pub half_life: u32,
    pub tie_breakers: Vec<TieBreakerKey>,
}

fn bad(field: &str, reason: &str) -> RankError {
    RankError::BadInput {
        field: field.to_string(),
        reason: reason.to_string(),
    }
}

/// Validates the governed parameters and the viewer's overrides, and
/// resolves the overrides against the network defaults (miner-api.md
/// "Inputs"; ranker-core §3.7).
pub(crate) fn calibrate(
    params: &RankParams,
    net: &NetworkParams,
) -> Result<Calibration, RankError> {
    let network = |reason: String| RankError::NetworkParameters { reason };
    if net.k == 0 {
        return Err(network("k must be at least 1".into()));
    }
    if net.gamma.is_nan() || net.gamma <= 0.0 || net.gamma > 1.0 {
        return Err(network(format!(
            "gamma = {} lies outside (0, 1]",
            net.gamma
        )));
    }
    if net.dust_floor.is_nan() || net.dust_floor < 0.0 {
        return Err(network(format!(
            "dust_floor = {} is negative",
            net.dust_floor
        )));
    }
    let mut named = BTreeSet::new();
    for key in &net.tie_breakers {
        if !named.insert(*key) {
            return Err(network(format!(
                "the tie-breaker composition names {} twice",
                key.parameter_name()
            )));
        }
    }
    let gamma = match params.gamma {
        Some(g) if g.is_nan() || g <= 0.0 || g > 1.0 => {
            return Err(bad("gamma", "must lie in (0, 1]"));
        }
        Some(g) => g,
        None => net.gamma,
    };
    let chi = match params.dust_floor {
        Some(c) if c.is_nan() || c < 0.0 => {
            return Err(bad("dustFloor", "must be non-negative"));
        }
        Some(c) if c > net.dust_floor => {
            return Err(bad(
                "dustFloor",
                "may only be finer than the network's dust floor",
            ));
        }
        Some(c) => c,
        None => net.dust_floor,
    };
    let half_life = match params.half_life_epochs {
        Some(h) => u32::try_from(h)
            .map_err(|_| bad("recencyHalfLifeEpochs", "must lie in 0..=4294967295"))?,
        None => net.half_life_epochs,
    };
    Ok(Calibration {
        k: net.k,
        gamma,
        chi,
        half_life,
        tie_breakers: net.tie_breakers.clone(),
    })
}

/// Checks the viewer's overrides against the published network parameters
/// before any slice is fetched: `gamma` in `(0, 1]`, a dust floor finer
/// than or equal to the network's, a half-life in range — and the network
/// parameters against their own domains.
pub fn check_params(params: &RankParams, net: &NetworkParams) -> Result<(), RankError> {
    calibrate(params, net).map(|_| ())
}

/// Reads one extracted walk as its path: sign, magnitude, recency and
/// contribution.
pub(crate) fn path_of(g: &Graph, walk: &Walk, half_life: u32) -> RankPath {
    let hops: Vec<RankHop> = walk
        .hops
        .iter()
        .map(|&h| {
            let hop = &g.hops[h];
            RankHop {
                family: hop.family,
                role: hop.role,
                author: hop.author.clone(),
                source: g.nodes[hop.source].graph_id.clone(),
                target: g.nodes[hop.target].graph_id.clone(),
                members: hop.members.clone(),
                p_directed: hop.folded.p_d,
                p_interest: hop.folded.p_i,
                tau: hop.tau,
                weight: hop.factor,
            }
        })
        .collect();
    let negatives = walk
        .hops
        .iter()
        .filter(|&&h| g.hops[h].folded.p_d < 0.0)
        .count();
    let tainted = walk.hops.iter().any(|&h| g.hops[h].folded.p_i < 0.0);
    let sign = if negatives % 2 == 0 && !tainted {
        1
    } else {
        -1
    };
    let magnitude = walk.magnitude(g);
    let terminal = walk
        .hops
        .last()
        .map(|&h| g.hops[h].folded.newest.landing_epoch);
    let recency = match terminal {
        Some(landed) => recency_factor(epoch_age(g.as_of_epoch, landed), half_life),
        None => 1.0,
    };
    let contribution = f64::from(sign) * magnitude * recency;
    RankPath {
        nodes: walk
            .nodes
            .iter()
            .map(|&n| g.nodes[n].graph_id.clone())
            .collect(),
        hops,
        sign,
        magnitude,
        recency,
        contribution,
    }
}

fn tie_breakers(g: &Graph, node: usize, cal: &Calibration) -> Result<TieBreakers, RankError> {
    let target = &g.nodes[node];
    let needs = |key| cal.tie_breakers.contains(&key);
    let statistic = |key: TieBreakerKey, read: fn(&crate::input::TieStatistics) -> f64| {
        if !needs(key) {
            return Ok(None);
        }
        target.statistics.as_ref().map(read).map(Some).ok_or_else(|| {
            RankError::malformed(format!(
                "the governed composition names {}, and the slice carries no statistics toward {}",
                key.parameter_name(),
                target.graph_id
            ))
        })
    };
    Ok(TieBreakers {
        net_stance: statistic(TieBreakerKey::NetStance, |s| s.net_stance)?,
        gross_volume: statistic(TieBreakerKey::GrossVolume, |s| s.gross_volume)?,
        genesis_epoch_age: target
            .genesis
            .map(|key| epoch_age(g.as_of_epoch, key.landing_epoch)),
    })
}

/// One candidate's entry, or `None` when no live path reaches it.
fn entry_for(
    g: &Graph,
    node: usize,
    first: Option<Walk>,
    cal: &Calibration,
) -> Result<Option<FeedEntry>, RankError> {
    let walks = extract(g, node, first, cal.k, cal.chi);
    if walks.is_empty() {
        return Ok(None);
    }
    let paths: Vec<RankPath> = walks.iter().map(|w| path_of(g, w, cal.half_life)).collect();
    let score = paths.iter().fold(0.0, |s, p| s + p.contribution);
    let target = &g.nodes[node];
    let (Some(target_id), Some(kind)) = (target.id.clone(), target.kind) else {
        return Ok(None);
    };
    Ok(Some(FeedEntry {
        target_id,
        target_graph_id: target.graph_id.clone(),
        kind,
        score,
        tie_breakers: tie_breakers(g, node, cal)?,
        paths,
    }))
}

/// The order of feed-ranking.md §7: `S` descending, then the governed
/// composition, then the backstop.
pub(crate) fn compare(g: &Graph, cal: &Calibration, a: &FeedEntry, b: &FeedEntry) -> Ordering {
    let by_score = b.score.total_cmp(&a.score);
    if by_score != Ordering::Equal {
        return by_score;
    }
    for key in &cal.tie_breakers {
        let order = match key {
            TieBreakerKey::NetStance => b
                .tie_breakers
                .net_stance
                .unwrap_or(0.0)
                .total_cmp(&a.tie_breakers.net_stance.unwrap_or(0.0)),
            TieBreakerKey::GrossVolume => b
                .tie_breakers
                .gross_volume
                .unwrap_or(0.0)
                .total_cmp(&a.tie_breakers.gross_volume.unwrap_or(0.0)),
            TieBreakerKey::Recency => newest_first(g, &a.target_graph_id, &b.target_graph_id),
        };
        if order != Ordering::Equal {
            return order;
        }
    }
    a.target_graph_id.cmp(&b.target_graph_id)
}

/// Genesis recency: newest genesis causal key first; a target without one
/// (a Type) after every dated target.
pub(crate) fn newest_first(g: &Graph, a: &str, b: &str) -> Ordering {
    let genesis = |id: &str| g.index.get(id).and_then(|&i| g.nodes[i].genesis);
    match (genesis(a), genesis(b)) {
        (Some(x), Some(y)) => y.cmp(&x),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => Ordering::Equal,
    }
}

/// Scores the given candidate nodes and sorts them.
pub(crate) fn rank_nodes(
    g: &Graph,
    candidates: &[usize],
    cal: &Calibration,
) -> Result<Vec<FeedEntry>, RankError> {
    let tree = dijkstra(
        g,
        &Residual {
            allowed: None,
            blocked: &vec![false; g.nodes.len()],
            direct_spent: None,
        },
        None,
    );
    let mut entries = Vec::new();
    for &node in candidates {
        if let Some(entry) = entry_for(g, node, walk_to(&tree, node), cal)? {
            entries.push(entry);
        }
    }
    entries.sort_by(|a, b| compare(g, cal, a, b));
    Ok(entries)
}

/// The candidate set of `rank`: every in-scope rankable node of the slice,
/// minus the viewer, the seen list, and — under a topic — whatever the
/// topic does not admit (feed-ranking.md §9; miner-api.md "Search
/// re-ranking" for the contrast).
pub(crate) fn feed_candidates(
    g: &Graph,
    params: &RankParams,
    cal: &Calibration,
) -> Result<Vec<usize>, RankError> {
    let kinds: BTreeSet<NodeKind> = match &params.kinds {
        Some(kinds) => kinds.iter().copied().collect(),
        None => [NodeKind::Post].into_iter().collect(),
    };
    let seen: BTreeSet<&str> = params.seen.iter().map(String::as_str).collect();
    let admitted = match &params.topic {
        Some(topic) => Some(crate::topic::admitted(g, topic, cal)?),
        None => None,
    };
    Ok((0..g.nodes.len())
        .filter(|&i| i != g.root)
        .filter(|&i| {
            let node = &g.nodes[i];
            match (&node.id, node.kind) {
                (Some(id), Some(kind)) => kinds.contains(&kind) && !seen.contains(id.as_str()),
                _ => false,
            }
        })
        .filter(|i| admitted.as_ref().is_none_or(|a| a.contains(i)))
        .collect())
}

/// Ranks the viewer's slice into an ordered feed: every in-scope candidate
/// a live path reaches, `S` descending, ties by the governed composition.
pub fn rank(
    slice: &Slice,
    params: &RankParams,
    net: &NetworkParams,
) -> Result<Vec<FeedEntry>, RankError> {
    let cal = calibrate(params, net)?;
    let g = Graph::build(slice, cal.gamma)?;
    let candidates = feed_candidates(&g, params, &cal)?;
    rank_nodes(&g, &candidates, &cal)
}

/// Re-orders search candidates by the viewer's score: the in-slice subset
/// of `candidates`, ordered. Only the calibration fields of `params` are
/// read; candidates outside the slice, or that no live path reaches, are
/// absent (miner-api.md "Search re-ranking").
pub fn rank_search(
    slice: &Slice,
    candidates: &[String],
    params: &RankParams,
    net: &NetworkParams,
) -> Result<Vec<FeedEntry>, RankError> {
    let cal = calibrate(params, net)?;
    let g = Graph::build(slice, cal.gamma)?;
    rank_search_nodes(&g, candidates, &cal)
}

/// `rank_search` over a built graph.
pub(crate) fn rank_search_nodes(
    g: &Graph,
    candidates: &[String],
    cal: &Calibration,
) -> Result<Vec<FeedEntry>, RankError> {
    let wanted: BTreeSet<&str> = candidates.iter().map(String::as_str).collect();
    let nodes: Vec<usize> = (0..g.nodes.len())
        .filter(|&i| i != g.root)
        .filter(|&i| {
            g.nodes[i].kind.is_some()
                && g.nodes[i]
                    .id
                    .as_deref()
                    .is_some_and(|id| wanted.contains(id))
        })
        .collect();
    rank_nodes(g, &nodes, cal)
}

/// One target's entry, computed alone — the device's spot-check primitive
/// (miner-api.md "Result integrity"). `None` when the target is outside the
/// slice or no live path reaches it.
pub fn score_target(
    slice: &Slice,
    target: &str,
    params: &RankParams,
    net: &NetworkParams,
) -> Result<Option<FeedEntry>, RankError> {
    let mut entries = rank_search(slice, &[target.to_string()], params, net)?;
    Ok(entries.pop())
}
