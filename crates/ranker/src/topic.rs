//! ´mod:module:topic´
//!
//! The topic narrowing (hashtag.md §4–§5; ranked-feed-api §5.2): under a
//! topic, a candidate is admitted only when the Tag channel test carries
//! one of its current tags toward the topic to the viewer.
//!
//! - **The fold is newest-wins, not summed.** A Tag is a standing claim;
//!   the author's latest record per (author, content, Type) is the current
//!   one, and relevance `0` reads as withdrawn (hashtag.md §4). A Tag
//!   cannot net accumulated confidence back down, so the stance fold of
//!   feed-ranking.md §3.2 is the wrong reading here.
//! - **The channel test is §4's.** A current non-zero tag counts when its
//!   author created the content (content-intrinsic), or when a live walk
//!   from the viewer reaches its author above the dust floor
//!   (initiator-owned) — never every stranger's.
//! - **A topic outside the slice admits nothing.** That is an empty
//!   ranking, not an error.

use std::collections::{BTreeMap, BTreeSet};

use crate::bundle::CausalKey;
use crate::census::{Family, LegRole};
use crate::error::RankError;
use crate::extract::{Residual, dijkstra, walk_to};
use crate::graph::{Graph, creator, person};
use crate::input::NodeKind;
use crate::rank::Calibration;

/// The persons a live walk from the viewer reaches with a product at or
/// above the dust floor, the viewer included.
pub(crate) fn reached_persons(g: &Graph, cal: &Calibration) -> BTreeSet<usize> {
    let tree = dijkstra(
        g,
        &Residual {
            allowed: None,
            blocked: &vec![false; g.nodes.len()],
            direct_spent: None,
        },
        None,
    );
    let mut reached = BTreeSet::from([g.root]);
    for (i, node) in g.nodes.iter().enumerate() {
        if i == g.root || !node.graph_id.starts_with("prof:") {
            continue;
        }
        if let Some(walk) = walk_to(&tree, i) {
            let m = walk.magnitude(g);
            if m > 0.0 && m >= cal.chi {
                reached.insert(i);
            }
        }
    }
    reached
}

/// The candidate nodes a topic admits.
pub(crate) fn admitted(
    g: &Graph,
    topic: &str,
    cal: &Calibration,
) -> Result<BTreeSet<usize>, RankError> {
    let Some(type_id) = g
        .nodes
        .iter()
        .find(|n| n.kind == Some(NodeKind::Hashtag) && n.id.as_deref() == Some(topic))
        .map(|n| n.graph_id.clone())
    else {
        return Ok(BTreeSet::new());
    };
    let mut current: BTreeMap<(String, String), (CausalKey, f64)> = BTreeMap::new();
    for record in &g.records {
        if record.family != Family::Tag || record.target != type_id {
            continue;
        }
        let (Some(content), Some(leg)) = (&record.middle, record.legs.get(&LegRole::A)) else {
            continue;
        };
        if leg.census_unknown {
            continue;
        }
        let slot = current
            .entry((record.author.clone(), content.clone()))
            .or_insert((record.key, leg.p_d));
        if record.key >= slot.0 {
            *slot = (record.key, leg.p_d);
        }
    }
    let reached = reached_persons(g, cal);
    let mut admitted = BTreeSet::new();
    for ((author, content), (_, relevance)) in current {
        if relevance == 0.0 {
            continue;
        }
        let intrinsic = creator(&content).as_deref() == Some(author.as_str());
        let through_author = g
            .index
            .get(&person(&author))
            .is_some_and(|i| reached.contains(i));
        if (intrinsic || through_author)
            && let Some(&i) = g.index.get(&content)
        {
            admitted.insert(i);
        }
    }
    Ok(admitted)
}
