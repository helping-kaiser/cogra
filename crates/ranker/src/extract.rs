//! ´mod:module:extract´
//!
//! The greedy disjoint-sum's extraction (feed-ranking.md §6.1):
//!
//! 1. `π₁` = the maximum-product live path `u → c`: Dijkstra on the per-hop
//!    cost `−ln(γ·w̃)`;
//! 2. delete `π₁`'s interior nodes (persons are one node);
//! 3. repeat until `k` paths are extracted or the best remaining product
//!    falls below `χ`.
//!
//! **Exact, never sampled.** Every extraction is a complete Dijkstra over
//! the live graph that remains.
//!
//! **Ties.** A label is the pair (cost, hop-key sequence), compared in that
//! order; hops are numbered in key order, so the sequence comparison is the
//! lexicographic comparison of the record identity keys §6.1 names. Costs
//! accumulate hop by hop, left to right, so every runner rounds them alike.
//!
//! **Three readings the spec leaves to the implementation, named:**
//!
//! - A path whose product is zero — an f64 underflow — stops extraction as
//!   the dust floor would (ranker-core §3.5). It would contribute exactly 0.
//! - A path with no interior node deletes no node, so read literally step 2
//!   would extract it again and again. The direct adjacency `u → c` counts
//!   once: once a direct path is extracted, no direct edge is crossed again.
//! - Channel gating can make the best walk visit a carrier twice — reaching
//!   it, leaving to the reference's author, and re-entering it over the
//!   author's own A-leg. The walk is what the gates allow, so it is what is
//!   extracted; both visits are interior, so disjointness holds. A walk
//!   ends where it first reaches its candidate: the candidate is never a
//!   carrier on its own walk.
//!
//! **What is optimised, and why it is exact.** The first extraction of every
//! candidate reads one shared Dijkstra tree from the viewer. Later ones run
//! only over the nodes that can still reach the candidate. A node's
//! Dijkstra label depends only on walks into it, and every node on a walk
//! into an ancestor of `c` is itself an ancestor of `c`, so neither changes
//! any label the candidate's paths are read from. The plain per-hop,
//! per-candidate reference in the test suite pins this (T-OPT-DIFF,
//! T-CHAN-DIFF).

use std::cmp::Ordering;
use std::collections::BTreeSet;

use crate::graph::{Edge, Graph};

/// A Dijkstra label: the walk's cost, its hop sequence, and how it arrived.
#[derive(Debug, Clone)]
pub(crate) struct Label {
    pub cost: f64,
    pub hops: Vec<usize>,
    pub pred: Option<(usize, Edge)>,
}

fn better(cost: f64, hops: &[usize], than: &Label) -> bool {
    match cost.total_cmp(&than.cost) {
        Ordering::Less => true,
        Ordering::Greater => false,
        Ordering::Equal => hops < than.hops.as_slice(),
    }
}

/// One queue entry, ordered as labels are.
#[derive(Debug, Clone, PartialEq)]
struct Queued {
    cost: f64,
    hops: Vec<usize>,
    node: usize,
}

impl Eq for Queued {}

impl PartialOrd for Queued {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Queued {
    fn cmp(&self, other: &Self) -> Ordering {
        self.cost
            .total_cmp(&other.cost)
            .then_with(|| self.hops.cmp(&other.hops))
            .then_with(|| self.node.cmp(&other.node))
    }
}

/// What one extraction round may not cross.
pub(crate) struct Residual<'a> {
    /// Nodes the round may enter at all; `None` admits every node.
    pub allowed: Option<&'a [bool]>,
    /// Interior nodes of the paths already extracted.
    pub blocked: &'a [bool],
    /// The candidate whose direct adjacency is spent, if it is.
    pub direct_spent: Option<usize>,
}

/// Dijkstra from the viewer over the residual graph, stopping once `stop`
/// is settled.
pub(crate) fn dijkstra(g: &Graph, residual: &Residual<'_>, stop: Option<usize>) -> Vec<Option<Label>> {
    let n = g.nodes.len();
    let mut labels: Vec<Option<Label>> = vec![None; n];
    let mut settled = vec![false; n];
    let mut queue = BTreeSet::new();
    labels[g.root] = Some(Label {
        cost: 0.0,
        hops: Vec::new(),
        pred: None,
    });
    queue.insert(Queued {
        cost: 0.0,
        hops: Vec::new(),
        node: g.root,
    });
    while let Some(Queued { node, .. }) = queue.pop_first() {
        if settled[node] {
            continue;
        }
        settled[node] = true;
        if Some(node) == stop {
            break;
        }
        let Some(here) = labels[node].clone() else {
            continue;
        };
        for edge in &g.out[node] {
            let to = edge.to;
            if to == g.root || settled[to] || residual.blocked[to] {
                continue;
            }
            if residual.allowed.is_some_and(|allowed| !allowed[to]) {
                continue;
            }
            if let Some(via) = edge.via {
                if via == g.root || residual.blocked[via] || Some(via) == stop {
                    continue;
                }
            } else if node == g.root && residual.direct_spent == Some(to) {
                continue;
            }
            let mut cost = here.cost + g.hops[edge.first].cost;
            let mut hops = here.hops.clone();
            hops.push(edge.first);
            if let Some(second) = edge.second {
                cost += g.hops[second].cost;
                hops.push(second);
            }
            let improves = match &labels[to] {
                None => true,
                Some(current) => better(cost, &hops, current),
            };
            if improves {
                queue.insert(Queued {
                    cost,
                    hops: hops.clone(),
                    node: to,
                });
                labels[to] = Some(Label {
                    cost,
                    hops,
                    pred: Some((node, *edge)),
                });
            }
        }
    }
    labels
}

/// One extracted walk: its nodes (viewer first, candidate last) and hops.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Walk {
    pub nodes: Vec<usize>,
    pub hops: Vec<usize>,
}

impl Walk {
    /// `m(π)`, accumulated left to right.
    pub(crate) fn magnitude(&self, g: &Graph) -> f64 {
        self.hops.iter().fold(1.0, |m, &h| m * g.hops[h].factor)
    }
}

/// Reads the walk a settled label stands for.
pub(crate) fn walk_to(labels: &[Option<Label>], target: usize) -> Option<Walk> {
    let mut steps = Vec::new();
    let mut at = target;
    labels[target].as_ref()?;
    while let Some((from, edge)) = labels[at].as_ref().and_then(|l| l.pred) {
        steps.push((from, edge));
        at = from;
    }
    steps.reverse();
    let mut nodes = vec![at];
    let mut hops = Vec::new();
    for (_, edge) in steps {
        hops.push(edge.first);
        if let (Some(second), Some(via)) = (edge.second, edge.via) {
            nodes.push(via);
            hops.push(second);
        }
        nodes.push(edge.to);
    }
    Some(Walk { nodes, hops })
}

/// The greedy extraction for one candidate: up to `k` disjoint walks,
/// strongest first, until the best remaining one falls below `chi` or
/// underflows. `first` is the candidate's walk in the shared tree.
pub(crate) fn extract(g: &Graph, candidate: usize, first: Option<Walk>, k: u32, chi: f64) -> Vec<Walk> {
    let mut walks: Vec<Walk> = Vec::new();
    let mut blocked = vec![false; g.nodes.len()];
    let mut direct_spent = None;
    let mut ancestors: Option<Vec<bool>> = None;
    let mut next = first;
    while (walks.len() as u64) < u64::from(k) {
        let Some(walk) = next.take() else {
            break;
        };
        let m = walk.magnitude(g);
        if !(m > 0.0) || m < chi {
            break;
        }
        let interior = &walk.nodes[1..walk.nodes.len() - 1];
        if interior.is_empty() {
            direct_spent = Some(candidate);
        }
        for &node in interior {
            blocked[node] = true;
        }
        walks.push(walk);
        if (walks.len() as u64) >= u64::from(k) {
            break;
        }
        let allowed = ancestors.get_or_insert_with(|| g.ancestors(candidate));
        let labels = dijkstra(
            g,
            &Residual {
                allowed: Some(allowed),
                blocked: &blocked,
                direct_spent,
            },
            Some(candidate),
        );
        next = walk_to(&labels, candidate);
    }
    walks
}
