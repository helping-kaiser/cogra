// Net stance — the bundle fold (`def:epoch:net-stance`,
// layer1-interface.md §11.3; adopted verbatim as CoGra's read-side fold in
// feed-ranking.md §3.2):
//
//     p̄_d = clip_[-1,1](Σ_e p_d(e)),  p̄_i = clip_[-1,1](Σ_e p_i(e))
//
// The sum is the storage question and the clip is the read rule, so the
// store returns raw sums and everything here works on them. Severance
// needs that distinction: a bundle is netted when its *sum* reaches zero,
// and a clipped sum has already lost how far away that is.

/// The closed range every authored parameter lives in (edges.md §1).
const LIMIT: f64 = 1.0;

/// One bundle's raw parameter sums — the fold's input, before the clip.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct BundleSum {
    pub p_d: f64,
    pub p_i: f64,
    /// How many records the sum folds — the bundle's length, which the
    /// readout reports and an empty bundle distinguishes from a netted one.
    pub records: u32,
}

/// A folded bundle: the pair a consumer of the standing projection reads.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct NetStance {
    pub p_d: f64,
    pub p_i: f64,
}

impl NetStance {
    /// Routing-inert on an axis: "an edge with either parameter at `0` is
    /// routing-inert; indifference is magnitude zero, not a third sign"
    /// (edges.md §1).
    pub fn is_inert(&self) -> bool {
        self.p_d == 0.0 || self.p_i == 0.0
    }

    /// Severance — the bundle nets to `(0, 0)` (design.md §8.2).
    pub fn is_severed(&self) -> bool {
        self.p_d == 0.0 && self.p_i == 0.0
    }
}

/// Sum-then-clip. `clip` returns the parameters to the master formula's
/// domain (`prop:epoch:net-stance-properties`, range-safety).
pub fn clip(x: f64) -> f64 {
    x.clamp(-LIMIT, LIMIT)
}

impl BundleSum {
    /// The folded pair this bundle currently stands at.
    pub fn fold(&self) -> NetStance {
        NetStance {
            p_d: clip(self.p_d),
            p_i: clip(self.p_i),
        }
    }

    /// Where one further record carrying `(p_d, p_i)` lands the bundle.
    /// The pick is appended to the sum, never subtracted from it — the
    /// record carries exactly the values picked (design.md §8.1).
    pub fn project(&self, p_d: f64, p_i: f64) -> NetStance {
        BundleSum {
            p_d: self.p_d + p_d,
            p_i: self.p_i + p_i,
            records: self.records + 1,
        }
        .fold()
    }

    /// The counter-records that net this bundle to `(0, 0)`.
    ///
    /// Netting means driving the *sum* to zero, and a single record is
    /// capped at `[-1, 1]`, so a bundle carrying more conviction than one
    /// record can walk back needs several — "author counter-records until
    /// your bundle toward the target nets to `(0,0)`... each counter-record
    /// debits θ" (feed-ranking.md §8.1). The count is
    /// `⌈max(|Σ_d|, |Σ_i|)⌉`.
    ///
    /// Each axis is walked back in whole steps of `1` with the remainder
    /// last, rather than in equal fractional shares, because the batch has
    /// to cancel the sum *exactly*: Layer 1 publishes no netting tolerance
    /// (`ε_clip` is deleted with no successor — layer1-interface.md §12), so
    /// a bundle left at `1e-16` is simply not severed and the author has
    /// paid θ for nothing. Whole steps keep every intermediate value exactly
    /// representable, so the counter-records sum to the negation of the
    /// bundle whatever order the store adds them in.
    pub fn severance_batch(&self) -> Vec<(f64, f64)> {
        let reach = self.p_d.abs().max(self.p_i.abs());
        if reach == 0.0 {
            return vec![];
        }
        let n = (reach.ceil() as u32).max(1);
        let d = walk_back(self.p_d, n);
        let i = walk_back(self.p_i, n);
        d.into_iter().zip(i).collect()
    }
}

/// One axis's walk-back: `n` values summing to exactly `-total`, each in
/// `[-1, 1]`, front-loaded in whole steps so every partial remainder stays
/// exactly representable.
fn walk_back(total: f64, n: u32) -> Vec<f64> {
    let sign = if total > 0.0 { -1.0 } else { 1.0 };
    let mut remaining = total.abs();
    (0..n)
        .map(|_| {
            let step = remaining.min(LIMIT);
            remaining -= step;
            sign * step
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sum(p_d: f64, p_i: f64) -> BundleSum {
        BundleSum {
            p_d,
            p_i,
            records: 1,
        }
    }

    #[test]
    fn fold_clips_to_the_unit_range() {
        assert_eq!(
            sum(2.5, -3.0).fold(),
            NetStance {
                p_d: 1.0,
                p_i: -1.0
            }
        );
        assert_eq!(
            sum(0.4, -0.25).fold(),
            NetStance {
                p_d: 0.4,
                p_i: -0.25
            }
        );
    }

    #[test]
    fn projection_appends_the_pick_rather_than_replacing_the_bundle() {
        // The raw-edge semantic: a (+0.5,+0.5) bundle plus a (+0.1,+0.1)
        // pick reads 0.6, not the picked 0.1 — the pick is one more edge.
        let projected = sum(0.5, 0.5).project(0.1, 0.1);
        assert!((projected.p_d - 0.6).abs() < 1e-12);
        assert!((projected.p_i - 0.6).abs() < 1e-12);
    }

    #[test]
    fn projection_clips_like_the_fold() {
        assert_eq!(
            sum(0.9, 0.9).project(1.0, 1.0),
            NetStance { p_d: 1.0, p_i: 1.0 }
        );
    }

    #[test]
    fn a_counter_pick_can_reach_severance_in_one_record() {
        // design.md §8.2: one (+1,+1) edge plus a new (-1,-1) nets to zero.
        assert!(sum(1.0, 1.0).project(-1.0, -1.0).is_severed());
    }

    #[test]
    fn inert_on_either_axis() {
        assert!(sum(0.0, 0.8).fold().is_inert());
        assert!(sum(0.8, 0.0).fold().is_inert());
        assert!(!sum(0.8, 0.8).fold().is_inert());
    }

    #[test]
    fn severed_is_both_axes_at_zero() {
        assert!(sum(0.0, 0.0).fold().is_severed());
        assert!(!sum(0.0, 0.3).fold().is_severed());
    }

    #[test]
    fn severance_of_an_empty_bundle_stages_nothing() {
        assert!(BundleSum::default().severance_batch().is_empty());
        assert!(sum(0.0, 0.0).severance_batch().is_empty());
    }

    #[test]
    fn severance_within_one_record_stages_one() {
        let b = sum(0.5, 0.5);
        let batch = b.severance_batch();
        assert_eq!(batch, vec![(-0.5, -0.5)]);
    }

    #[test]
    fn severance_beyond_one_record_stages_a_batch_that_nets_to_zero() {
        // A long history: the sum is 2.5, past what one record can cancel.
        let b = sum(2.5, -1.2);
        let batch = b.severance_batch();
        assert_eq!(batch.len(), 3, "⌈max(2.5, 1.2)⌉ counter-records");
        for (p_d, p_i) in &batch {
            assert!((-1.0..=1.0).contains(p_d), "every record stays authorable");
            assert!((-1.0..=1.0).contains(p_i));
        }
        let net_d: f64 = batch.iter().map(|(d, _)| d).sum();
        let net_i: f64 = batch.iter().map(|(_, i)| i).sum();
        assert!((b.p_d + net_d).abs() < 1e-12);
        assert!((b.p_i + net_i).abs() < 1e-12);
    }

    #[test]
    fn severance_at_exactly_one_stages_one_record() {
        assert_eq!(sum(1.0, -1.0).severance_batch().len(), 1);
    }

    #[test]
    fn severance_of_a_sub_unit_bundle_stages_one_record() {
        assert_eq!(sum(0.05, 0.0).severance_batch().len(), 1);
    }

    #[test]
    fn severance_batch_applied_to_the_bundle_folds_to_zero() {
        let b = sum(-3.4, 2.9);
        let mut running = b;
        for (p_d, p_i) in b.severance_batch() {
            running = BundleSum {
                p_d: running.p_d + p_d,
                p_i: running.p_i + p_i,
                records: running.records + 1,
            };
        }
        assert!(running.fold().is_severed());
    }
}
