//! ´mod:module:spot´
//!
//! The device's spot-check (miner-api.md "Result integrity"; open-questions
//! Q24): "the device can re-rank any handful of targets locally and
//! compare, or re-derive any fold from the raw records". The ranking is
//! deterministic over public records, so an honest answer reproduces bit
//! for bit and any tampering shows up as a named field.
//!
//! For each sampled target, in id order: every claimed hop must re-fold
//! from its own member records; the claimed entry must equal the one this
//! crate computes, field for field and bit for bit — or both must be
//! absent; and the sampled targets the claim lists must stand in the order
//! the cascade gives them.

use crate::bundle::{Member, fold_members};
use crate::error::RankError;
use crate::graph::Graph;
use crate::input::{NetworkParams, RankParams, Slice};
use crate::output::{FeedEntry, RankHop, RankPath, TieBreakers};
use crate::rank::{calibrate, compare, feed_candidates, rank_nodes};

/// A spot-check's verdict.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SpotCheck {
    /// Every sampled target reproduced.
    Clean,
    /// The first sampled target that did not, and the first field of it
    /// that differs.
    Mismatch { target: String, field: String },
}

fn bits(x: f64) -> u64 {
    x.to_bits()
}

fn same_opt(a: Option<f64>, b: Option<f64>) -> bool {
    a.map(bits) == b.map(bits)
}

fn tie_field(claimed: &TieBreakers, honest: &TieBreakers) -> Option<&'static str> {
    if !same_opt(claimed.net_stance, honest.net_stance) {
        Some("tieBreakers.netStance")
    } else if !same_opt(claimed.gross_volume, honest.gross_volume) {
        Some("tieBreakers.grossVolume")
    } else if claimed.genesis_epoch_age != honest.genesis_epoch_age {
        Some("tieBreakers.genesisEpochAge")
    } else {
        None
    }
}

fn hop_field(claimed: &RankHop, honest: &RankHop) -> Option<&'static str> {
    if (claimed.family, claimed.role) != (honest.family, honest.role)
        || claimed.author != honest.author
        || claimed.source != honest.source
        || claimed.target != honest.target
    {
        Some("identity")
    } else if claimed.members != honest.members {
        Some("members")
    } else if bits(claimed.p_directed) != bits(honest.p_directed)
        || bits(claimed.p_interest) != bits(honest.p_interest)
    {
        Some("fold")
    } else if bits(claimed.tau) != bits(honest.tau) {
        Some("tau")
    } else if bits(claimed.weight) != bits(honest.weight) {
        Some("weight")
    } else {
        None
    }
}

fn path_field(claimed: &RankPath, honest: &RankPath) -> Option<String> {
    if claimed.nodes != honest.nodes {
        return Some("nodes".into());
    }
    if claimed.hops.len() != honest.hops.len() {
        return Some("hops".into());
    }
    for (j, (c, h)) in claimed.hops.iter().zip(&honest.hops).enumerate() {
        if let Some(field) = hop_field(c, h) {
            return Some(format!("hops[{j}].{field}"));
        }
    }
    if claimed.sign != honest.sign {
        Some("sign".into())
    } else if bits(claimed.magnitude) != bits(honest.magnitude) {
        Some("magnitude".into())
    } else if bits(claimed.recency) != bits(honest.recency) {
        Some("recency".into())
    } else if bits(claimed.contribution) != bits(honest.contribution) {
        Some("contribution".into())
    } else {
        None
    }
}

/// The first field in which a claimed entry departs from the honest one.
fn entry_field(claimed: &FeedEntry, honest: &FeedEntry) -> Option<String> {
    if claimed.target_graph_id != honest.target_graph_id || claimed.kind != honest.kind {
        return Some("target".into());
    }
    if bits(claimed.score) != bits(honest.score) {
        return Some("score".into());
    }
    if let Some(field) = tie_field(&claimed.tie_breakers, &honest.tie_breakers) {
        return Some(field.into());
    }
    if claimed.paths.len() != honest.paths.len() {
        return Some("paths".into());
    }
    for (i, (c, h)) in claimed.paths.iter().zip(&honest.paths).enumerate() {
        if let Some(field) = path_field(c, h) {
            return Some(format!("paths[{i}].{field}"));
        }
    }
    None
}

/// Whether a claimed hop's folded pair is the fold of its own members.
fn refolds(hop: &RankHop) -> bool {
    let members: Vec<Member> = hop
        .members
        .iter()
        .map(|m| Member {
            key: m.key,
            p_d: m.p_d,
            p_i: m.p_i,
        })
        .collect();
    fold_members(&members)
        .is_ok_and(|f| bits(f.p_d) == bits(hop.p_directed) && bits(f.p_i) == bits(hop.p_interest))
}

/// Re-ranks the sampled targets from the slice and compares them with a
/// claimed ranking.
pub fn spot_check(
    slice: &Slice,
    params: &RankParams,
    net: &NetworkParams,
    claimed: &[FeedEntry],
    sample: &[String],
) -> Result<SpotCheck, RankError> {
    let cal = calibrate(params, net)?;
    let g = Graph::build(slice, cal.gamma)?;
    let candidates = feed_candidates(&g, params, &cal)?;
    let mut targets: Vec<&String> = sample.iter().collect();
    targets.sort();
    targets.dedup();
    let sampled: Vec<usize> = candidates
        .iter()
        .copied()
        .filter(|&i| {
            g.nodes[i]
                .id
                .as_ref()
                .is_some_and(|id| targets.contains(&id))
        })
        .collect();
    let honest_entries = rank_nodes(&g, &sampled, &cal)?;
    for target in &targets {
        let mismatch = |field: &str| SpotCheck::Mismatch {
            target: (*target).clone(),
            field: field.to_string(),
        };
        let honest = honest_entries.iter().find(|e| &e.target_id == *target);
        let claim = claimed.iter().find(|e| &e.target_id == *target);
        if let Some(claim) = claim {
            for (i, path) in claim.paths.iter().enumerate() {
                for (j, hop) in path.hops.iter().enumerate() {
                    if !refolds(hop) {
                        return Ok(mismatch(&format!("paths[{i}].hops[{j}].refold")));
                    }
                }
            }
        }
        match (claim, honest) {
            (None, None) => {}
            (Some(_), None) => return Ok(mismatch("present")),
            (None, Some(_)) => return Ok(mismatch("absent")),
            (Some(c), Some(h)) => {
                if let Some(field) = entry_field(c, h) {
                    return Ok(mismatch(&field));
                }
            }
        }
    }
    let listed: Vec<&FeedEntry> = claimed
        .iter()
        .filter(|e| targets.iter().any(|t| **t == e.target_id))
        .collect();
    for pair in listed.windows(2) {
        let (Some(a), Some(b)) = (
            honest_entries
                .iter()
                .find(|h| h.target_id == pair[0].target_id),
            honest_entries
                .iter()
                .find(|h| h.target_id == pair[1].target_id),
        ) else {
            continue;
        };
        if compare(&g, &cal, a, b) != std::cmp::Ordering::Less {
            return Ok(SpotCheck::Mismatch {
                target: pair[1].target_id.clone(),
                field: "order".into(),
            });
        }
    }
    Ok(SpotCheck::Clean)
}
