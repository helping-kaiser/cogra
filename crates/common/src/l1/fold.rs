//! ´mod:module:fold´
//!
//! Net stance — the bundle fold (layer1-interface.md §11.3; adopted verbatim
//! as CoGra's read-side fold in feed-ranking.md §3.2):
//!
//! ```text
//! p̄_d = clip_[-1,1](Σ_e p_d(e)),  p̄_i = clip_[-1,1](Σ_e p_i(e))
//! ```
//!
//! The sum is the storage question and the clip is the read rule, so the
//! store returns raw sums and everything here works on them. Severance needs
//! that distinction: a bundle is netted when its *sum* reaches zero, and a
//! clipped sum has already lost how far away that is.
//!
//! Every sum is exact decimal arithmetic ([`super::exact`]; edges.md §1):
//! the store, the ranker and the projection all add the decimals the
//! records' doubles denote and round once at the end, so whether a bundle
//! sits at `(0, 0)` is one answer whatever order its records arrive in.

use super::exact::{Decimal, NotFinite, exact_add, exact_sum};

/// The closed range every authored parameter lives in (edges.md §1).
const LIMIT: f64 = 1.0;

/// One bundle's raw parameter sums — the fold's input, before the clip.
///
/// Each sum is the exact decimal sum of the bundle's records rounded once to
/// the nearest double, and zero exactly when the exact sum is — build one
/// with [`BundleSum::of_records`] or [`BundleSum::from_decimals`], never by
/// adding doubles.
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
/// domain — the range-safety property of layer1-interface.md §11.3.
///
/// Two values `clamp` alone leaves outside that domain, both normalised
/// here so the reference is at least as defensive as the clients that
/// re-implement it:
///
/// - `-0.0` is not a direction. It arises wherever a difference of equals
///   is negated — on the clients, from a pad whose vertical axis is
///   inverted — and `-0.0 == 0.0` compares true while the two serialise
///   differently, so an unnormalised zero travels into a record as a
///   value of its own.
/// - `NaN` names no point in the range at all, and `f64::clamp` returns
///   it unchanged. The origin is the only answer in domain that carries
///   no direction, so that is what a nonsense parameter folds to. It is a
///   floor, not a semantic: a sum that reached `NaN` is refused where
///   sums are assembled ([`BundleSum::severance_cost`]), because there
///   the answer would be fabricated rather than merely bounded.
pub fn clip(x: f64) -> f64 {
    if x.is_nan() {
        return 0.0;
    }
    let bounded = x.clamp(-LIMIT, LIMIT);
    if bounded == 0.0 { 0.0 } else { bounded }
}

impl BundleSum {
    /// The exact sum of a bundle's records, `(p_d, p_i)` each — the same
    /// sums whatever order the records come in. A non-finite parameter has
    /// no decimal to add and is refused.
    pub fn of_records<I: IntoIterator<Item = (f64, f64)>>(
        records: I,
    ) -> Result<BundleSum, NotFinite> {
        let (mut d, mut i) = (Vec::new(), Vec::new());
        for (p_d, p_i) in records {
            d.push(p_d);
            i.push(p_i);
        }
        let records = u32::try_from(d.len()).unwrap_or(u32::MAX);
        Ok(BundleSum::from_decimals(
            &exact_sum(d)?,
            &exact_sum(i)?,
            records,
        ))
    }

    /// A bundle from exact sums already assembled — the store's `numeric`
    /// sums, read back as decimals.
    pub fn from_decimals(p_d: &Decimal, p_i: &Decimal, records: u32) -> BundleSum {
        BundleSum {
            p_d: p_d.to_f64(),
            p_i: p_i.to_f64(),
            records,
        }
    }

    /// The folded pair this bundle currently stands at.
    pub fn fold(&self) -> NetStance {
        NetStance {
            p_d: clip(self.p_d),
            p_i: clip(self.p_i),
        }
    }

    /// Where one further record carrying `(p_d, p_i)` lands the bundle.
    /// The pick is appended to the sum, never subtracted from it — the
    /// record carries exactly the values picked (design.md §8.1). Appended
    /// exactly, so a pick that cancels the sum lands on `(0, 0)` and not one
    /// rounding error beside it.
    pub fn project(&self, p_d: f64, p_i: f64) -> NetStance {
        BundleSum {
            p_d: exact_add(self.p_d, p_d),
            p_i: exact_add(self.p_i, p_i),
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
    /// paid θ for nothing. The steps are taken in exact decimal arithmetic
    /// on the decimal the sum denotes, so a sum of hundredths walks back in
    /// hundredths — `2.3` as `−1, −1, −0.3`, never the `−0.2999999999999998`
    /// floating subtraction leaves — and the batch nets the bundle in any
    /// order. A remainder with more than fifteen significant digits (only a
    /// bundle holding values authored before the grid was enforced) may not
    /// survive the trip to a double; such a batch nets as near as a double
    /// reaches, and the exact read says honestly that it did not sever.
    pub fn severance_batch(&self) -> Vec<(f64, f64)> {
        let n = self.reach_steps();
        let (Some(d), Some(i)) = (Decimal::of_f64(self.p_d), Decimal::of_f64(self.p_i)) else {
            return vec![];
        };
        if n == 0 {
            return vec![];
        }
        walk_back(&d, n).into_iter().zip(walk_back(&i, n)).collect()
    }

    /// `⌈max(|Σ_d|, |Σ_i|)⌉` — the one place the step count is computed, so
    /// the staged batch and the quoted cost cannot drift apart.
    ///
    /// A non-finite sum on *either* axis yields no steps — `f64::max` drops
    /// a `NaN`, so the axes are tested before they are compared. Such a sum
    /// names no bundle a batch could net, and every alternative answer is
    /// fabricated: the saturating float-to-integer cast turns `inf` into a
    /// `u32::MAX`-element allocation, and `f64::min` turns `NaN` into a
    /// whole-step counter-record for a value that has none. Refusing the
    /// value where sums are assembled is the store's own boundary.
    fn reach_steps(&self) -> usize {
        if !self.p_d.is_finite() || !self.p_i.is_finite() {
            return 0;
        }
        let reach = self.p_d.abs().max(self.p_i.abs());
        if reach == 0.0 {
            return 0;
        }
        (reach.ceil() as usize).max(1)
    }

    /// How many counter-records [`severance_batch`] would stage —
    /// `⌈max(|Σ_d|, |Σ_i|)⌉`, and 0 for a bundle already netted.
    ///
    /// This is the *cost* half of the same answer, so read surfaces that
    /// only quote a number take it from here rather than assembling a
    /// batch they then measure and drop.
    ///
    /// [`severance_batch`]: BundleSum::severance_batch
    pub fn severance_cost(&self) -> usize {
        self.reach_steps()
    }
}

/// One author's bundle toward one target read as a STANDING — what the
/// pad's readout, the walk-back and a row's "which `(0, 0)`" read
/// (api-spec.md `StanceBundle`): the sums the fold clips, plus the one
/// fact about order the sums cannot carry.
///
/// A bundle at `(0, 0)` is one of two things. Walked back — severed —
/// when the record that brought it there said something: a counter-pick,
/// a severance batch. Saying nothing when that record was itself
/// `(0, 0)`: an empty sign, a priced record that says nothing and leaves
/// the standing where it was (design.md §8.4). The sums are equal; the
/// newest record is what tells them apart, so a standing carries it.
///
/// [`NetStance::is_severed`] stays the LANDING predicate — where a pick
/// lands is a pair, and a pair at `(0, 0)` reaches severance whatever
/// came before it. [`Standing::is_severed`] is the BUNDLE's reading.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Standing {
    pub sum: BundleSum,
    /// Whether the bundle's newest record — last in the published order,
    /// with the author's own acts in flight after everything landed —
    /// carries a pair other than exactly `(0, 0)`. False on an empty
    /// bundle, which has no newest record.
    pub newest_says_something: bool,
}

impl Standing {
    /// A standing from its records in published order, oldest first. The
    /// sums are order-free ([`BundleSum::of_records`]); the last record is
    /// the newest.
    pub fn of_records<I: IntoIterator<Item = (f64, f64)>>(
        records: I,
    ) -> Result<Standing, NotFinite> {
        let records: Vec<(f64, f64)> = records.into_iter().collect();
        let newest_says_something = records.last().is_some_and(|&(d, i)| says_something(d, i));
        Ok(Standing {
            sum: BundleSum::of_records(records)?,
            newest_says_something,
        })
    }

    /// The sums sit at exactly zero on both axes. Tested on the raw sums,
    /// not the fold: the clip keeps zero exact, and a non-finite sum names
    /// no bundle at zero.
    fn nets_to_zero(&self) -> bool {
        self.sum.p_d == 0.0 && self.sum.p_i == 0.0
    }

    /// Severed: walked back to nothing. The bundle nets to `(0, 0)` and the
    /// newest record said something — the act that brought it to nothing
    /// took something back. An empty bundle is not severed (nothing was
    /// ever walked back), and neither is one an empty sign left at
    /// `(0, 0)`, over nothing or over a walk-back: that standing says
    /// nothing. Whether a `(0, 0)` record landing over a standing that
    /// already says nothing reads as a walk-back is open (open-questions.md
    /// Q60); this reads it as saying nothing.
    pub fn is_severed(&self) -> bool {
        self.newest_says_something && self.nets_to_zero()
    }

    /// The bundle holds records and stands at `(0, 0)` without being
    /// severed — the standing an empty sign leaves, which speaks "Says
    /// nothing" and can still be walked back.
    pub fn says_nothing(&self) -> bool {
        self.sum.records > 0 && !self.newest_says_something && self.nets_to_zero()
    }

    /// The records the walk-back stages: the sum's own counter-records
    /// ([`BundleSum::severance_batch`]), and for a standing that says
    /// nothing one `(0, 0)` record — the sum has nothing left to cancel,
    /// and the walk-back stays available at the cost of one record
    /// (api-spec.md "The read-side bundle fold").
    pub fn severance_batch(&self) -> Vec<(f64, f64)> {
        if self.says_nothing() {
            return vec![(0.0, 0.0)];
        }
        self.sum.severance_batch()
    }

    /// How many records [`Standing::severance_batch`] stages: the sum's
    /// `⌈max(|Σ_d|, |Σ_i|)⌉`, 1 for a standing that says nothing, and 0 for
    /// an empty or severed bundle.
    pub fn severance_cost(&self) -> usize {
        if self.says_nothing() {
            return 1;
        }
        self.sum.severance_cost()
    }
}

/// A record says something when its pair is anything but exactly `(0, 0)`.
/// `-0.0` compares equal to `0.0`, so a negative zero says nothing either.
fn says_something(p_d: f64, p_i: f64) -> bool {
    p_d != 0.0 || p_i != 0.0
}

/// One axis's walk-back: `n` values whose decimals sum to exactly `-total`,
/// each in `[-1, 1]`, front-loaded in whole steps with the remainder last.
fn walk_back(total: &Decimal, n: usize) -> Vec<f64> {
    let one = Decimal::one();
    let mut remaining = total.abs();
    (0..n)
        .map(|_| {
            let step = std::cmp::min(remaining.clone(), one.clone());
            remaining = &remaining - &step;
            let counter = if total.is_negative() { step } else { -&step };
            counter.to_f64()
        })
        .collect()
}

/// Which records of one stance bundle a walk-back signed, given the
/// bundle's records in published order, oldest first — one flag per
/// record (api-spec.md `RecordAct.WALK_BACK`).
///
/// A walk-back is the act that brings a bundle that says something to
/// `(0, 0)`: a counter-pick landing there, or a severance batch. The
/// record that lands it is the one [`Standing::is_severed`] reads at — a
/// record that says something, after which the bundle nets to exactly
/// zero. A batch signs more records than that one, and every one of them
/// is the walk-back's: the batch is the gesture, priced record by record.
///
/// The batch is recognised by its shape, which is fully determined by the
/// bundle it walks back: [`Standing::severance_batch`] of the sum standing
/// before it. So the records ending at a severing record are a batch
/// exactly when they are the records the sum before them stages — the
/// widest such run is taken, and a run never reaches back past the last
/// point the bundle stood at `(0, 0)`, where no walk-back can start. The
/// run is compared as a multiset, never as a sequence: a batch's records
/// declare no dependency on one another, so the host may order them as it
/// likes (layer1-interface.md, host ordering discretion), and the sum
/// before the run does not depend on the order inside it. A counter-pick
/// that lands at `(0, 0)` is the one-record case of the same test, which
/// every severing record passes.
///
/// An empty sign is never a walk-back: a `(0, 0)` record says nothing,
/// whatever it lands on (open-questions.md Q60 reads a `(0, 0)` landing
/// over a standing that already says nothing as saying nothing).
///
/// A non-finite parameter has no decimal to sum and is refused, as
/// [`BundleSum::of_records`] refuses it.
pub fn walk_back_records(records: &[(f64, f64)]) -> Result<Vec<bool>, NotFinite> {
    let mut prefix = Vec::with_capacity(records.len() + 1);
    prefix.push((Decimal::zero(), Decimal::zero()));
    for &(p_d, p_i) in records {
        let (d, i) = prefix.last().expect("seeded with the empty prefix");
        let next = (
            d + &Decimal::of_f64(p_d).ok_or(NotFinite)?,
            i + &Decimal::of_f64(p_i).ok_or(NotFinite)?,
        );
        prefix.push(next);
    }
    let at_zero = |k: usize| prefix[k].0.is_zero() && prefix[k].1.is_zero();
    let mut marks = vec![false; records.len()];
    let mut floor = 0;
    for (k, &(p_d, p_i)) in records.iter().enumerate() {
        if !at_zero(k + 1) {
            continue;
        }
        if says_something(p_d, p_i) {
            let start = (floor..k)
                .find(|&j| {
                    let before = BundleSum::from_decimals(
                        &prefix[j].0,
                        &prefix[j].1,
                        u32::try_from(j).unwrap_or(u32::MAX),
                    );
                    before.severance_cost() == k - j + 1
                        && same_records(before.severance_batch(), &records[j..=k])
                })
                .unwrap_or(k);
            marks[start..=k].fill(true);
        }
        floor = k + 1;
    }
    Ok(marks)
}

/// Whether two runs hold the same records, whatever their order. Zero is
/// compared as one value — `-0.0` and `0.0` are the same parameter.
fn same_records(mut staged: Vec<(f64, f64)>, landed: &[(f64, f64)]) -> bool {
    fn canonical(pairs: &mut [(f64, f64)]) {
        for (d, i) in pairs.iter_mut() {
            *d += 0.0;
            *i += 0.0;
        }
        pairs.sort_by(|a, b| a.0.total_cmp(&b.0).then(a.1.total_cmp(&b.1)));
    }
    let mut landed = landed.to_vec();
    canonical(&mut staged);
    canonical(&mut landed);
    staged == landed
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

    /// The quoted cost and the staged batch answer the same question, so
    /// they may never disagree — a read surface quoting one number while
    /// the write path stages another is the failure this pins.
    ///
    /// The non-finite pairs are sums no bundle can reach, so neither
    /// surface may invent an answer for one: the cast that saturates and
    /// the `min` that swallows a `NaN` are what they pin shut.
    ///
    /// The quoted severance cost is the batch it prices, so a read surface and the write path can never disagree about it.
    /// ´claim:fold:the-quoted-cost-is-the-batch-it-prices´
    #[test]
    fn the_severance_cost_is_the_length_of_the_batch_it_prices() {
        for (p_d, p_i) in [
            (0.0, 0.0),
            (0.05, 0.0),
            (0.5, 0.5),
            (1.0, -1.0),
            (2.5, -1.2),
            (-3.4, 2.9),
            (0.0, 7.1),
            (f64::NAN, f64::NAN),
            (f64::NAN, 0.5),
            (f64::INFINITY, 0.0),
            (f64::NEG_INFINITY, 2.0),
        ] {
            let bundle = sum(p_d, p_i);
            assert_eq!(
                bundle.severance_cost(),
                bundle.severance_batch().len(),
                "at ({p_d}, {p_i})"
            );
        }
        assert_eq!(sum(f64::INFINITY, 0.0).severance_cost(), 0);
        assert!(sum(f64::NAN, f64::NAN).severance_batch().is_empty());
    }

    /// The two values `clamp` leaves outside the domain. `is_sign_negative`
    /// rather than `==`, because `-0.0 == 0.0` is true and would let an
    /// unnormalised zero pass.
    ///
    /// A clip answers with a value in the domain for every input, negative zero and NaN included.
    /// ´claim:fold:a-clip-answers-in-domain-for-every-input´
    #[test]
    fn clip_normalises_negative_zero_and_nan() {
        assert!(!clip(-0.0).is_sign_negative(), "-0.0 is not a direction");
        assert!(
            !sum(0.3, 0.3).project(-0.3, -0.3).p_d.is_sign_negative(),
            "and neither is a landing that arrived at zero from above"
        );
        assert_eq!(clip(f64::NAN), 0.0);
        assert_eq!(clip(f64::INFINITY), LIMIT);
        assert_eq!(clip(f64::NEG_INFINITY), -LIMIT);
        assert!(sum(-0.0, f64::NAN).fold().is_severed());
    }

    /// A fold clips into the unit range on both axes, whatever the bundle's sum reached.
    /// ´claim:fold:a-fold-clips-into-the-unit-range´
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

    /// The raw-edge semantic: a pick is one more edge, so a (+0.5, +0.5)
    /// bundle taking a (+0.1, +0.1) pick reads 0.6, not the picked 0.1.
    ///
    /// A pick is one more edge on the bundle and never a replacement of what the bundle already holds.
    /// ´claim:fold:a-pick-is-appended-and-never-a-replacement´
    #[test]
    fn projection_appends_the_pick_rather_than_replacing_the_bundle() {
        let projected = sum(0.5, 0.5).project(0.1, 0.1);
        assert_eq!(projected, NetStance { p_d: 0.6, p_i: 0.6 });
    }

    /// The projection clips where the fold does, so a preview never promises more.
    ///
    /// (´claim:fold:a-fold-clips-into-the-unit-range´)
    #[test]
    fn projection_clips_like_the_fold() {
        assert_eq!(
            sum(0.9, 0.9).project(1.0, 1.0),
            NetStance { p_d: 1.0, p_i: 1.0 }
        );
    }

    /// A bundle within one record's reach severs in one: a (+1, +1) edge
    /// plus a fresh (-1, -1) nets to zero (design.md §8.2).
    ///
    /// A bundle within one record's reach severs in a single counter-record.
    /// ´claim:fold:a-bundle-within-reach-severs-in-one-record´
    #[test]
    fn a_counter_pick_can_reach_severance_in_one_record() {
        assert!(sum(1.0, 1.0).project(-1.0, -1.0).is_severed());
    }

    /// A bundle is inert as soon as either axis reaches zero.
    /// ´claim:fold:a-bundle-is-inert-when-either-axis-is-zero´
    #[test]
    fn inert_on_either_axis() {
        assert!(sum(0.0, 0.8).fold().is_inert());
        assert!(sum(0.8, 0.0).fold().is_inert());
        assert!(!sum(0.8, 0.8).fold().is_inert());
    }

    /// A bundle is severed only when both axes are zero.
    /// ´claim:fold:a-bundle-is-severed-only-when-both-axes-are-zero´
    #[test]
    fn severed_is_both_axes_at_zero() {
        assert!(sum(0.0, 0.0).fold().is_severed());
        assert!(!sum(0.0, 0.3).fold().is_severed());
    }

    /// A bundle with nothing left to cancel stages no severance at all.
    /// ´claim:fold:a-bundle-with-nothing-to-cancel-stages-nothing´
    #[test]
    fn severance_of_an_empty_bundle_stages_nothing() {
        assert!(BundleSum::default().severance_batch().is_empty());
        assert!(sum(0.0, 0.0).severance_batch().is_empty());
    }

    /// A bundle one record can cancel stages exactly that one record.
    /// ´claim:fold:a-bundle-one-record-can-cancel-stages-one´
    #[test]
    fn severance_within_one_record_stages_one() {
        let b = sum(0.5, 0.5);
        let batch = b.severance_batch();
        assert_eq!(batch, vec![(-0.5, -0.5)]);
    }

    /// A long history carries a sum past what one record can cancel, so the
    /// batch runs to several — each still authorable, and together cancelling
    /// the bundle exactly.
    ///
    /// A sum past one record's reach stages a batch whose records are each authorable and together cancel exactly.
    /// ´claim:fold:a-sum-past-one-record-stages-an-authorable-batch´
    #[test]
    fn severance_beyond_one_record_stages_a_batch_that_nets_to_zero() {
        let b = sum(2.5, -1.2);
        let batch = b.severance_batch();
        assert_eq!(batch.len(), 3, "⌈max(2.5, 1.2)⌉ counter-records");
        for (p_d, p_i) in &batch {
            assert!((-1.0..=1.0).contains(p_d), "every record stays authorable");
            assert!((-1.0..=1.0).contains(p_i));
        }
        assert_eq!(
            batch,
            vec![(-1.0, 1.0), (-1.0, 0.2), (-0.5, 0.0)],
            "walked back in hundredths, never in floating remainders"
        );
        assert!(nets_to_zero(b, &batch));
    }

    /// The bundle plus its batch, summed exactly.
    fn nets_to_zero(b: BundleSum, batch: &[(f64, f64)]) -> bool {
        BundleSum::of_records(std::iter::once((b.p_d, b.p_i)).chain(batch.iter().copied()))
            .expect("finite")
            .fold()
            .is_severed()
    }

    /// At exactly one, the boundary the batch length turns on.
    ///
    /// (´claim:fold:a-bundle-one-record-can-cancel-stages-one´)
    #[test]
    fn severance_at_exactly_one_stages_one_record() {
        assert_eq!(sum(1.0, -1.0).severance_batch().len(), 1);
    }

    /// And below one, where a batch of none would leave the bundle standing.
    ///
    /// (´claim:fold:a-bundle-one-record-can-cancel-stages-one´)
    #[test]
    fn severance_of_a_sub_unit_bundle_stages_one_record() {
        assert_eq!(sum(0.05, 0.0).severance_batch().len(), 1);
    }

    /// Applying a severance batch to the bundle it was computed for leaves that bundle severed.
    /// ´claim:fold:a-severance-batch-severs-the-bundle-it-priced´
    #[test]
    fn severance_batch_applied_to_the_bundle_folds_to_zero() {
        let b = sum(-3.4, 2.9);
        let batch = b.severance_batch();
        assert_eq!(
            batch,
            vec![(1.0, -1.0), (1.0, -1.0), (1.0, -0.9), (0.4, 0.0)]
        );
        assert!(nets_to_zero(b, &batch));
        let mut reversed = batch.clone();
        reversed.reverse();
        assert!(nets_to_zero(b, &reversed), "in any order");
    }

    /// Every ordering of a bundle's records folds to the same bits: the sum
    /// is exact, so addition order is not an input.
    ///
    /// A bundle's sums are the same bits in every order its records arrive in.
    /// ´claim:fold:a-bundle-sums-the-same-in-every-order´
    #[test]
    fn a_bundle_sums_the_same_in_every_order() {
        let records = [(0.1, 0.7), (0.2, -0.1), (-0.3, 0.3), (0.6, -0.2)];
        let reference = BundleSum::of_records(records).expect("finite");
        assert_eq!((reference.p_d, reference.p_i), (0.6, 0.7));
        for a in 0..4 {
            for b in 0..4 {
                if a == b {
                    continue;
                }
                let mut shuffled = records;
                shuffled.swap(a, b);
                let again = BundleSum::of_records(shuffled).expect("finite");
                assert_eq!(again.p_d.to_bits(), reference.p_d.to_bits());
                assert_eq!(again.p_i.to_bits(), reference.p_i.to_bits());
            }
        }
        assert!(BundleSum::of_records([(f64::NAN, 0.1)]).is_err());
    }

    /// The known-dirty pattern: a (0.1 + 0.2) bundle sums to 0.3 exactly —
    /// floating point says 0.30000000000000004 — so walking it back by the
    /// shown 0.3, by projection or by severance, reaches exact zero.
    ///
    /// A bundle of dirty float members walks back to exact zero.
    /// ´claim:fold:a-dirty-bundle-walks-back-to-exact-zero´
    #[test]
    fn a_dirty_bundle_walks_back_to_exact_zero() {
        assert_ne!(0.1 + 0.2, 0.3, "the float sum is dirty");
        let b = BundleSum::of_records([(0.1, 0.1), (0.2, 0.2)]).expect("finite");
        assert_eq!((b.p_d, b.p_i), (0.3, 0.3));
        assert!(b.project(-0.3, -0.3).is_severed());
        assert_eq!(b.severance_batch(), vec![(-0.3, -0.3)]);
        assert!(nets_to_zero(b, &b.severance_batch()));
        assert!(
            BundleSum::of_records([(0.2, 0.2), (-0.3, -0.3), (0.1, 0.1)])
                .expect("finite")
                .fold()
                .is_severed(),
            "the walked-back bundle, in another order"
        );
    }

    /// An off-grid system value is held exactly and walks back exactly.
    ///
    /// An off-grid record nets and severs exactly.
    /// ´claim:fold:an-off-grid-record-severs-exactly´
    #[test]
    fn an_off_grid_record_severs_exactly() {
        let b = BundleSum::of_records([(0.00047, 1.0), (0.1, 0.0)]).expect("finite");
        assert_eq!(b.p_d, 0.10047);
        let batch = b.severance_batch();
        assert_eq!(batch, vec![(-0.10047, -1.0)]);
        assert!(nets_to_zero(b, &batch));
        assert!(!b.project(-0.1, -1.0).is_severed(), "0.00047 still stands");

        let legacy = 0.00047147125005719825;
        let b = BundleSum::of_records([(legacy, 1.0)]).expect("finite");
        assert_eq!(b.severance_batch(), vec![(-legacy, -1.0)]);
        assert!(nets_to_zero(b, &b.severance_batch()));
        assert!(
            !b.project(-0.0004714712500572, -1.0).is_severed(),
            "a neighbouring decimal is a different value"
        );
    }

    /// Exact zero keeps the two predicates apart: one axis netted to zero
    /// is inert and still standing; both netted is severed.
    ///
    /// Exact zero keeps inert and severed apart: one axis netted is inert and standing, both netted is severed.
    /// ´claim:fold:exact-zero-keeps-inert-and-severed-apart´
    #[test]
    fn exact_zero_keeps_inert_and_severed_apart() {
        let one_axis = BundleSum::of_records([(0.1, 0.5), (0.2, 0.5), (-0.3, 0.0)])
            .expect("finite")
            .fold();
        assert!(one_axis.is_inert());
        assert!(!one_axis.is_severed());
        let both = BundleSum::of_records([(0.1, 0.4), (0.2, -0.1), (-0.3, -0.3)])
            .expect("finite")
            .fold();
        assert!(both.is_inert());
        assert!(both.is_severed());
    }

    fn standing(records: &[(f64, f64)]) -> Standing {
        Standing::of_records(records.iter().copied()).expect("finite")
    }

    /// An empty sign over nothing: one `(0, 0)` record. It counts, the fold
    /// stays at `(0, 0)`, the bundle is not severed, and the walk-back stays
    /// available at the cost of one record.
    ///
    /// An empty sign counts as a record, leaves the bundle at zero unsevered, and leaves the walk-back available at one record.
    /// ´claim:fold:an-empty-sign-counts-and-does-not-sever´
    #[test]
    fn an_empty_sign_counts_and_does_not_sever() {
        let s = standing(&[(0.0, 0.0)]);
        assert_eq!(s.sum.records, 1, "the record counts");
        assert_eq!(s.sum.fold(), NetStance { p_d: 0.0, p_i: 0.0 });
        assert!(s.sum.fold().is_severed(), "the pair is (0, 0)…");
        assert!(!s.is_severed(), "…but nothing was walked back");
        assert!(s.says_nothing());
        assert_eq!(s.severance_cost(), 1);
        assert_eq!(s.severance_batch(), vec![(0.0, 0.0)]);
        assert!(
            !s.severance_batch()[0].0.is_sign_negative()
                && !s.severance_batch()[0].1.is_sign_negative(),
            "the staged record is a positive zero, never a direction"
        );
        let negative_zero = standing(&[(-0.0, 0.0)]);
        assert!(!negative_zero.is_severed() && negative_zero.says_nothing());
    }

    /// The ordinary severance: (+1, +1) then (−1, −1). The newest record
    /// said something and the sum is zero, so the bundle is walked back,
    /// with nothing left to stage.
    ///
    /// A bundle a saying record brings to zero reads severed, with nothing left to stage.
    /// ´claim:fold:a-walk-back-to-zero-reads-severed´
    #[test]
    fn a_walk_back_to_zero_reads_severed() {
        let s = standing(&[(1.0, 1.0), (-1.0, -1.0)]);
        assert_eq!(s.sum.records, 2);
        assert!(s.is_severed());
        assert!(!s.says_nothing());
        assert_eq!(s.severance_cost(), 0);
        assert!(s.severance_batch().is_empty());
        assert!(
            standing(&[(0.3, 0.3), (0.0, 0.0), (-0.3, -0.3)]).is_severed(),
            "a (0, 0) pick over a standing adds nothing and blocks no later walk-back"
        );
        assert!(
            standing(&[(0.0, 0.0), (0.4, 0.2), (-0.4, -0.2)]).is_severed(),
            "an earlier empty sign does not keep a later walk-back from reading severed"
        );
    }

    /// An empty sign over a walked-back bundle: nothing stands, so the
    /// `(0, 0)` record is the empty sign's, and the bundle stops reading
    /// severed — it says nothing, and walks back at one record
    /// (stance-control.md, "while nothing stands — never signed, or already
    /// walked back").
    ///
    /// An empty sign over a walked-back bundle leaves it saying nothing, not severed.
    /// ´claim:fold:an-empty-sign-over-a-walk-back-says-nothing´
    #[test]
    fn an_empty_sign_over_a_walk_back_says_nothing() {
        let s = standing(&[(0.5, 0.5), (-0.5, -0.5), (0.0, 0.0)]);
        assert_eq!(s.sum.records, 3);
        assert!(!s.is_severed());
        assert!(s.says_nothing());
        assert_eq!(s.severance_cost(), 1);
    }

    /// The open case (open-questions.md Q60): every record `(0, 0)`, two or
    /// more of them — an empty sign, then a confirmed `(0, 0)` landing over
    /// it. Read as saying nothing: nothing ever stood to be walked back.
    ///
    /// A bundle of only empty records, however many, says nothing and is not severed.
    /// ´claim:fold:a-bundle-of-only-empty-records-says-nothing´
    #[test]
    fn a_bundle_of_only_empty_records_says_nothing() {
        for n in 2..=4 {
            let s = standing(&vec![(0.0, 0.0); n]);
            assert_eq!(s.sum.records as usize, n);
            assert!(!s.is_severed(), "{n} empty records");
            assert!(s.says_nothing());
            assert_eq!(s.severance_cost(), 1);
            assert_eq!(s.severance_batch(), vec![(0.0, 0.0)]);
        }
    }

    /// One axis netted to zero is inert and still standing — never severed,
    /// never saying nothing — and walks back by the sum, as before.
    ///
    /// A bundle at zero on one axis only is inert, standing, and walked back by its sum.
    /// ´claim:fold:a-one-zero-standing-is-inert-not-severed´
    #[test]
    fn a_one_zero_standing_is_inert_not_severed() {
        let s = standing(&[(0.1, 0.5), (-0.1, 0.0)]);
        assert!(s.sum.fold().is_inert());
        assert!(!s.is_severed());
        assert!(!s.says_nothing());
        assert_eq!(s.severance_cost(), 1, "⌈max(0, 0.5)⌉");
        assert_eq!(s.severance_batch(), vec![(0.0, -0.5)]);
        assert!(!s.severance_batch()[0].0.is_sign_negative());
    }

    /// Nothing signed: not severed, saying nothing of its own, and no walk-back.
    ///
    /// An empty bundle is neither severed nor saying nothing, and stages no walk-back.
    /// ´claim:fold:an-empty-bundle-is-neither-severed-nor-empty-signed´
    #[test]
    fn an_empty_bundle_is_neither_severed_nor_empty_signed() {
        let s = Standing::default();
        assert_eq!(s, standing(&[]));
        assert!(!s.is_severed());
        assert!(!s.says_nothing());
        assert_eq!(s.severance_cost(), 0);
        assert!(s.severance_batch().is_empty());
    }

    /// The standing's quoted cost is the batch it stages, in every state.
    ///
    /// (´claim:fold:the-quoted-cost-is-the-batch-it-prices´)
    #[test]
    fn the_standing_cost_is_the_length_of_its_batch() {
        for records in [
            vec![],
            vec![(0.0, 0.0)],
            vec![(0.0, 0.0), (0.0, 0.0)],
            vec![(1.0, 1.0), (-1.0, -1.0)],
            vec![(0.5, 0.5), (-0.5, -0.5), (0.0, 0.0)],
            vec![(0.8, 0.5), (0.8, 0.5), (0.8, 0.5)],
            vec![(0.1, 0.5), (-0.1, 0.0)],
        ] {
            let s = standing(&records);
            assert_eq!(s.severance_cost(), s.severance_batch().len(), "{records:?}");
        }
    }

    /// The batch a walk-back stages is the walk-back, every record of it:
    /// a bundle summing past one record's reach walks back in several, and
    /// each one reads as the walk-back — the last alone would leave the
    /// rest reading as opinions against.
    ///
    /// Every record of a severance batch reads as the walk-back, not only the one that lands the bundle at zero.
    /// ´claim:fold:every-record-of-a-severance-batch-is-the-walk-back´
    #[test]
    fn every_record_of_a_severance_batch_is_the_walk_back() {
        let given = [(0.8, 0.5), (0.8, 0.5), (0.8, 0.5)];
        let batch = standing(&given).severance_batch();
        assert_eq!(batch.len(), 3, "⌈2.4⌉");
        let bundle: Vec<(f64, f64)> = given.iter().copied().chain(batch).collect();
        assert_eq!(
            walk_back_records(&bundle).expect("finite"),
            vec![false, false, false, true, true, true]
        );
    }

    /// The host may publish a batch's records in any order — they declare
    /// no dependency on one another — and the batch is still the walk-back,
    /// every record of it.
    ///
    /// A severance batch reads as the walk-back in whatever order the host published its records.
    /// ´claim:fold:a-batch-is-the-walk-back-in-any-published-order´
    #[test]
    fn a_batch_is_the_walk_back_in_any_published_order() {
        let given = [(0.8, 0.5), (0.8, 0.5), (0.8, 0.5)];
        let mut batch = standing(&given).severance_batch();
        batch.reverse();
        let bundle: Vec<(f64, f64)> = given.iter().copied().chain(batch).collect();
        assert_eq!(
            walk_back_records(&bundle).expect("finite"),
            vec![false, false, false, true, true, true]
        );
    }

    /// A counter-pick that lands the bundle at `(0, 0)` is a walk-back of
    /// one record; the records the bundle stood on before it are not, and
    /// neither is a later pick that says something again.
    ///
    /// A counter-pick landing at zero is a one-record walk-back, and only it.
    /// ´claim:fold:a-counter-pick-to-zero-is-a-one-record-walk-back´
    #[test]
    fn a_counter_pick_to_zero_is_a_one_record_walk_back() {
        let bundle = [(0.5, 0.2), (-0.2, 0.1), (-0.3, -0.3), (0.4, 0.4)];
        assert_eq!(
            walk_back_records(&bundle).expect("finite"),
            vec![false, false, true, false]
        );
    }

    /// The run a batch is recognised by never reaches past an earlier point
    /// at `(0, 0)`, and a pick that merely shares a value with a batch step
    /// does not join it: only the records the sum before them would stage
    /// are the batch.
    ///
    /// A walk-back is read off the records since the bundle last stood at zero, and only the batch shape joins it.
    /// ´claim:fold:a-walk-back-never-reaches-past-the-last-zero´
    #[test]
    fn a_walk_back_never_reaches_past_the_last_zero() {
        // 1.0 walked back by one record, then 1.5 by its batch (−1, −0.5);
        // the opening −1.0 counter-pick before it matched a batch step's
        // value and still is not part of the second walk-back.
        let bundle = [
            (1.0, 1.0),
            (-1.0, -1.0),
            (1.0, 1.0),
            (0.5, 0.5),
            (-1.0, -1.0),
            (-0.5, -0.5),
        ];
        assert_eq!(
            walk_back_records(&bundle).expect("finite"),
            vec![false, true, false, false, true, true]
        );
        // A user who walks a 1.5 down by hand with −0.6 then −0.9 signed
        // no batch: only the pick that lands at zero is the walk-back.
        let by_hand = [(1.0, 1.0), (0.5, 0.5), (-0.6, -0.6), (-0.9, -0.9)];
        assert_eq!(
            walk_back_records(&by_hand).expect("finite"),
            vec![false, false, false, true]
        );
    }

    /// An empty sign is never a walk-back — not over nothing, not over a
    /// severed bundle, and not the one `(0, 0)` record that walks back a
    /// standing that says nothing (open-questions.md Q60 reads it as
    /// saying nothing).
    ///
    /// A record at zero never reads as a walk-back.
    /// ´claim:fold:an-empty-sign-is-never-a-walk-back´
    #[test]
    fn an_empty_sign_is_never_a_walk_back() {
        let bundle = [(0.0, 0.0), (0.3, 0.3), (-0.3, -0.3), (0.0, 0.0), (0.0, 0.0)];
        assert_eq!(
            walk_back_records(&bundle).expect("finite"),
            vec![false, false, true, false, false]
        );
        assert_eq!(walk_back_records(&[]).expect("finite"), Vec::<bool>::new());
        assert!(walk_back_records(&[(f64::NAN, 0.0)]).is_err());
    }
}
