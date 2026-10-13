//! ´mod:module:bundle´
//!
//! The fold — per-author net stance (feed-ranking.md §3.2): a same-author
//! bundle nets by sum-then-clip into one effective edge `(p̄_d, p̄_i)`, its
//! temporal attributes taken from the bundle's ≺-newest member.
//!
//! The netting itself is common's `BundleSum::fold` — the seam's one fold,
//! adopted rather than re-derived, so there is no CoGra-side variant to
//! trust (feed-ranking.md §3.1 "One formula, three consumers"). What this
//! module adds is the order: floating addition is not associative, so the
//! members are summed in authoritative order ≺, causal key ascending
//! (ranker-core D-c), whatever order they arrived in (D-d).

use std::cmp::Ordering;

use common::l1::fold::BundleSum;

use crate::error::RankError;

/// A record's place in the authoritative order: its landing epoch, then its
/// causal key `(𝕋^act, pos)` (layer1-interface.md §8.3).
///
/// Layer 1 publishes a total order per epoch, `pos` totalising equal Lamport
/// times within it; the published sequence is those orders epoch after
/// epoch, so the landing epoch leads. It is the api's `CausalKey`, field for
/// field and in the same precedence.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct CausalKey {
    pub landing_epoch: i64,
    pub act_time: i64,
    pub position: i64,
}

impl PartialOrd for CausalKey {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for CausalKey {
    fn cmp(&self, other: &Self) -> Ordering {
        (self.landing_epoch, self.act_time, self.position).cmp(&(
            other.landing_epoch,
            other.act_time,
            other.position,
        ))
    }
}

/// One member record of a bundle, as the fold reads it: where it stands in
/// ≺ and the parameters its leg carries.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Member {
    pub key: CausalKey,
    pub p_d: f64,
    pub p_i: f64,
}

/// A folded bundle: the net stance and what stands behind it.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Folded {
    /// `p̄_d = clip(Σ p_d)`.
    pub p_d: f64,
    /// `p̄_i = clip(Σ p_i)`.
    pub p_i: f64,
    /// How many member records the bundle folds.
    pub members: u32,
    /// The ≺-newest member's key — the bundle's temporal attributes.
    pub newest: CausalKey,
}

impl Folded {
    /// Routing-inert: either folded parameter is zero (feed-ranking.md §3.1).
    pub fn is_inert(&self) -> bool {
        self.p_d == 0.0 || self.p_i == 0.0
    }
}

/// Folds a bundle's members. Sorts them into ≺ first, so the input order
/// never matters; sums each axis from `+0` in that order; clips with
/// common's fold.
///
/// Refuses an empty bundle and two members claiming one causal key, which a
/// conforming slice cannot hold: the published order is total.
pub fn fold_members(members: &[Member]) -> Result<Folded, RankError> {
    let mut ordered = members.to_vec();
    ordered.sort_by_key(|m| m.key);
    if let Some(pair) = ordered.windows(2).find(|w| w[0].key == w[1].key) {
        return Err(RankError::malformed(format!(
            "two bundle members claim the causal key {:?}",
            pair[0].key
        )));
    }
    let newest = ordered
        .last()
        .map(|m| m.key)
        .ok_or_else(|| RankError::malformed("a bundle with no members"))?;
    let mut sum = BundleSum::default();
    for member in &ordered {
        sum = BundleSum {
            p_d: sum.p_d + member.p_d,
            p_i: sum.p_i + member.p_i,
            records: sum.records + 1,
        };
    }
    let net = sum.fold();
    Ok(Folded {
        p_d: net.p_d,
        p_i: net.p_i,
        members: sum.records,
        newest,
    })
}
