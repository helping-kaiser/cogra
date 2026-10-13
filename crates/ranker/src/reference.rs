//! The plain reference implementation the optimised extraction is pinned
//! against (ranker-core §3.3, §3.5; T-CHAN-DIFF, T-OPT-DIFF).
//!
//! It shares nothing with the production walk but the folded hops: no
//! composite edges, no shared tree, no ancestor pruning. Its Dijkstra runs
//! over states `(node, the hop that arrived)`, checks every channel gate per
//! hop — a gated T-leg crosses from the carrier only when the walk arrived
//! over the same bundle's A-leg, unless its author created what the gate
//! protects — and runs from scratch for every candidate and every round.

use std::cmp::Ordering;
use std::collections::{BTreeMap, BTreeSet};

use crate::census::{Family, LegRole};
use crate::extract::Walk;
use crate::graph::{Graph, HopKey, creator, is_type};
use crate::output::FeedEntry;
use crate::rank::{Calibration, compare, path_of};

/// For each hop: `None` when it is ungated or opened by the
/// content-intrinsic channel, else the hop of the same bundle's A-leg it
/// must continue (`Some(None)` when that A-leg is not live).
fn gates(g: &Graph) -> Vec<Option<Option<usize>>> {
    let by_key: BTreeMap<&HopKey, usize> = g
        .hops
        .iter()
        .enumerate()
        .map(|(i, h)| (&h.key, i))
        .collect();
    g.hops
        .iter()
        .map(|hop| {
            if hop.role != LegRole::T {
                return None;
            }
            let bundle = &hop.key.bundle;
            let intrinsic = match hop.family {
                Family::Reference | Family::Tag => {
                    creator(&bundle.middle).as_deref() == Some(bundle.author.as_str())
                }
                Family::Review => {
                    creator(&bundle.target).as_deref() == Some(bundle.author.as_str())
                }
                _ => return None,
            };
            if intrinsic {
                return None;
            }
            let a = HopKey {
                bundle: bundle.clone(),
                role: LegRole::A.wire_name().to_string(),
            };
            Some(by_key.get(&a).copied())
        })
        .collect()
}

#[derive(Debug, Clone)]
struct Label {
    cost: f64,
    hops: Vec<usize>,
}

fn better(cost: f64, hops: &[usize], than: &Label) -> bool {
    match cost.total_cmp(&than.cost) {
        Ordering::Less => true,
        Ordering::Greater => false,
        Ordering::Equal => hops < than.hops.as_slice(),
    }
}

type State = (usize, Option<usize>);

/// The best walk to `target` over the residual graph, by per-hop states.
fn best_walk(
    g: &Graph,
    gates: &[Option<Option<usize>>],
    target: usize,
    blocked: &[bool],
    direct_spent: bool,
) -> Option<Walk> {
    let mut labels: BTreeMap<State, Label> = BTreeMap::new();
    let mut settled: BTreeSet<State> = BTreeSet::new();
    let mut queue: BTreeSet<(OrderedCost, Vec<usize>, State)> = BTreeSet::new();
    let start = (g.root, None);
    labels.insert(
        start,
        Label {
            cost: 0.0,
            hops: Vec::new(),
        },
    );
    queue.insert((OrderedCost(0.0), Vec::new(), start));
    while let Some((_, _, state)) = queue.pop_first() {
        if !settled.insert(state) {
            continue;
        }
        let (node, last) = state;
        if node == target || is_type(&g.nodes[node].graph_id) {
            continue;
        }
        let Some(here) = labels.get(&state).cloned() else {
            continue;
        };
        for (h, hop) in g.hops.iter().enumerate() {
            if hop.source != node || hop.target == g.root || blocked[hop.target] {
                continue;
            }
            if let Some(required) = gates[h]
                && (required.is_none() || last != required)
            {
                continue;
            }
            if direct_spent && state == start && hop.target == target {
                continue;
            }
            let next = (hop.target, Some(h));
            if settled.contains(&next) {
                continue;
            }
            let cost = here.cost + hop.cost;
            let mut hops = here.hops.clone();
            hops.push(h);
            let improves = labels.get(&next).is_none_or(|l| better(cost, &hops, l));
            if improves {
                queue.insert((OrderedCost(cost), hops.clone(), next));
                labels.insert(next, Label { cost, hops });
            }
        }
    }
    let best = labels
        .iter()
        .filter(|((node, _), _)| *node == target)
        .map(|(_, l)| l)
        .min_by(|a, b| a.cost.total_cmp(&b.cost).then_with(|| a.hops.cmp(&b.hops)))?;
    let mut nodes = vec![g.root];
    for &h in &best.hops {
        nodes.push(g.hops[h].target);
    }
    Some(Walk {
        nodes,
        hops: best.hops.clone(),
    })
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct OrderedCost(f64);

impl Eq for OrderedCost {}

impl PartialOrd for OrderedCost {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for OrderedCost {
    fn cmp(&self, other: &Self) -> Ordering {
        self.0.total_cmp(&other.0)
    }
}

/// The reference ranking of the given candidates.
pub(crate) fn rank_reference(g: &Graph, candidates: &[usize], cal: &Calibration) -> Vec<FeedEntry> {
    let gates = gates(g);
    let mut entries = Vec::new();
    for &c in candidates {
        let mut blocked = vec![false; g.nodes.len()];
        let mut direct_spent = false;
        let mut walks = Vec::new();
        while (walks.len() as u64) < u64::from(cal.k) {
            let Some(walk) = best_walk(g, &gates, c, &blocked, direct_spent) else {
                break;
            };
            let m = walk.magnitude(g);
            if m.is_nan() || m <= 0.0 || m < cal.chi {
                break;
            }
            let interior = &walk.nodes[1..walk.nodes.len() - 1];
            if interior.is_empty() {
                direct_spent = true;
            }
            for &n in interior {
                blocked[n] = true;
            }
            walks.push(walk);
        }
        if walks.is_empty() {
            continue;
        }
        let paths: Vec<_> = walks.iter().map(|w| path_of(g, w, cal.half_life)).collect();
        let node = &g.nodes[c];
        let (Some(target_id), Some(kind)) = (node.id.clone(), node.kind) else {
            continue;
        };
        entries.push(FeedEntry {
            target_id,
            target_graph_id: node.graph_id.clone(),
            kind,
            score: paths.iter().fold(0.0, |s, p| s + p.contribution),
            tie_breakers: crate::output::TieBreakers {
                net_stance: None,
                gross_volume: None,
                genesis_epoch_age: node
                    .genesis
                    .map(|k| crate::recency::epoch_age(g.as_of_epoch, k.landing_epoch)),
            },
            paths,
        });
    }
    entries.sort_by(|a, b| compare(g, cal, a, b));
    entries
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::input::RankParams;
    use crate::rank::{calibrate, rank_nodes};
    use crate::testkit::{any_slice, check, network};

    fn every_candidate(g: &Graph) -> Vec<usize> {
        (0..g.nodes.len())
            .filter(|&i| i != g.root && g.nodes[i].id.is_some())
            .collect()
    }

    /// T-CHAN-DIFF and T-OPT-DIFF in one comparison: the composite-edge,
    /// shared-tree, ancestor-pruned extraction against the per-hop,
    /// per-candidate reference, every candidate of every kind, at `k = 8`
    /// and at `k = 2`.
    ///
    /// The optimised extraction equals the plain per-hop, per-candidate reference bit for bit over random slices.
    /// ´claim:reference:the-optimised-extraction-equals-the-reference´
    #[test]
    fn optimised_extraction_equals_the_reference() {
        check(512, any_slice(), |slice| {
            for k in [8, 2] {
                let net = crate::input::NetworkParams { k, ..network() };
                let cal = calibrate(&RankParams::default(), &net).expect("valid");
                let g = Graph::build(&slice, cal.gamma).expect("a generated slice builds");
                let candidates = every_candidate(&g);
                let fast = rank_nodes(&g, &candidates, &cal).expect("ranks");
                let slow = rank_reference(&g, &candidates, &cal);
                proptest::prop_assert_eq!(format!("{fast:?}"), format!("{slow:?}"));
            }
            Ok(())
        });
    }
}
