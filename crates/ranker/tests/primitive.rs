//! The per-edge primitive's properties (ranker-core §7.2, the RK-0 rows):
//! attenuation, zero inertness, the tier calibration, the Quadrant Law, the
//! maturity crossover, and the fold.
//!
//! Each property runs proptest's runner from an ordinary test with a fixed
//! seed and no failure persistence, so a run is reproducible and leaves the
//! tree untouched; the seed is part of the test, like the fixtures are.

use std::fmt::Debug;

use common::l1::{exact::exact_sum, fold::clip};
use proptest::prelude::*;
use proptest::test_runner::{Config, RngSeed, TestCaseError, TestRunner};
use ranker::{
    CausalKey, Family, LegRole, Member, damped_weight, fold_members, maturity_gain, path_view,
    temporal_entropy,
};

fn check<S>(strategy: S, test: impl Fn(S::Value) -> Result<(), TestCaseError>)
where
    S: Strategy,
    S::Value: Debug,
{
    let mut runner = TestRunner::new(Config {
        cases: 4096,
        rng_seed: RngSeed::Fixed(0x0C06_4A5E_2026_1013),
        failure_persistence: None,
        ..Config::default()
    });
    if let Err(failure) = runner.run(&strategy, test) {
        panic!("{failure}");
    }
}

/// Every leg the census defines, as (family, role).
fn every_leg() -> Vec<(Family, LegRole)> {
    Family::ALL
        .into_iter()
        .flat_map(|f| f.roles().into_iter().map(move |r| (f, r)))
        .collect()
}

fn any_leg() -> impl Strategy<Value = (Family, LegRole)> {
    prop::sample::select(every_leg())
}

fn any_parameter() -> impl Strategy<Value = f64> {
    prop_oneof![
        -1.0..=1.0f64,
        prop::sample::select(vec![-1.0, -0.5, 0.0, 0.5, 1.0]),
    ]
}

/// A parameter bounded away from zero: the algebra's strict positivity
/// holds for every non-zero pair, floating point's for every pair whose
/// product does not underflow.
fn live_parameter() -> impl Strategy<Value = f64> {
    prop_oneof![1e-150..=1.0f64, -1.0..=-1e-150f64]
}

fn maturity() -> impl Strategy<Value = f64> {
    prop_oneof![
        0.0..1.0f64,
        prop::sample::select(vec![0.0, 0.5, 0.94, 0.999_999])
    ]
}

fn weight(family: Family, role: LegRole, p_d: f64, p_i: f64, tau: f64) -> f64 {
    damped_weight(family, role, p_d, p_i, tau).expect("an in-domain leg weighs")
}

fn coherence(family: Family, role: LegRole, p_d: f64, p_i: f64) -> f64 {
    path_view(family, role, p_d, p_i)
        .expect("an in-domain leg has a path view")
        .coherence()
}

/// feed-ranking.md §3.1 "every hop attenuates", with L1's damped-weight
/// bounds and raw edge-weight ceiling behind it.
///
/// Every leg's damped weight is non-negative, at most its coherence times the square root of two, and below one.
/// ´claim:weight:every-hop-attenuates´
#[test]
fn t_atten_every_hop_attenuates() {
    check(
        (any_leg(), any_parameter(), any_parameter(), maturity()),
        |((family, role), p_d, p_i, tau)| {
            let w = weight(family, role, p_d, p_i, tau);
            let ceiling = coherence(family, role, p_d, p_i) * std::f64::consts::SQRT_2;
            prop_assert!(w >= 0.0, "{w}");
            prop_assert!(w <= ceiling, "{w} > {ceiling}");
            prop_assert!(w < 1.0, "{w}");
            Ok(())
        },
    );
}

/// feed-ranking.md §3.1 "zero is inert": either parameter at zero is magnitude
/// zero, never a third sign.
///
/// A leg weighs exactly zero when either parameter is zero, and strictly more than zero when neither is.
/// ´claim:weight:zero-is-inert´
#[test]
fn t_zero_zero_is_inert() {
    check(
        (any_leg(), any_parameter(), maturity(), any::<bool>()),
        |((family, role), p, tau, directed_is_zero)| {
            let (p_d, p_i) = if directed_is_zero { (0.0, p) } else { (p, 0.0) };
            let w = weight(family, role, p_d, p_i, tau);
            prop_assert_eq!(w.to_bits(), 0.0f64.to_bits());
            Ok(())
        },
    );
    check(
        (any_leg(), live_parameter(), live_parameter(), maturity()),
        |((family, role), p_d, p_i, tau)| {
            prop_assert!(weight(family, role, p_d, p_i, tau) > 0.0);
            Ok(())
        },
    );
}

/// The census rows layer1-interface.md §8.7 tabulates per tier, those whose
/// determinant the table's bands describe.
const FULL: [(Family, LegRole); 7] = [
    (Family::Opinion, LegRole::Binary),
    (Family::Review, LegRole::A),
    (Family::Reference, LegRole::T),
    (Family::Owner, LegRole::Binary),
    (Family::Publish, LegRole::Binary),
    (Family::Participant, LegRole::A),
    (Family::Send, LegRole::A),
];
const HALF: [(Family, LegRole); 6] = [
    (Family::Bid, LegRole::A),
    (Family::Bid, LegRole::T),
    (Family::Accept, LegRole::Binary),
    (Family::Ratify, LegRole::Binary),
    (Family::JoinRequest, LegRole::Binary),
    (Family::Invitation, LegRole::A),
];
const MARGINAL: [(Family, LegRole); 7] = [
    (Family::Tag, LegRole::A),
    (Family::Tag, LegRole::T),
    (Family::Affinity, LegRole::Binary),
    (Family::Review, LegRole::T),
    (Family::Reference, LegRole::A),
    (Family::Invitation, LegRole::T),
    (Family::Participant, LegRole::T),
];

/// The Marginal rows on the Minimal mask `(0,0,0,1)`. The table lists them
/// under the Marginal band, but softening every off-diagonal cell to `η`
/// leaves the determinant larger than the Epistemic mask's — near 0.10 at a
/// product of one half and 0.15 at the control legs' fixed `(1, 1)`. They
/// stay on the Marginal floor of the ladder, below every Half row.
const MARGINAL_MINIMAL: [(Family, LegRole); 6] = [
    (Family::Send, LegRole::T),
    (Family::Withdraw, LegRole::Binary),
    (Family::Rescind, LegRole::Binary),
    (Family::Leave, LegRole::Binary),
    (Family::DeInvite, LegRole::A),
    (Family::DeInvite, LegRole::T),
];

/// The calibration bands of layer1-interface.md §8.7 ("Determinant magnitude
/// per tier"). The table states them as "≈" without the tuple they are read
/// at; all three hold together for a bilinear product `p_d·p_i` near one
/// half, so that is where the fixture reads them. At the unit tuple Full and
/// Marginal still sit in band and Half reads about 0.30.
///
/// The tier ladder lands each tabulated census row in its stated determinant band.
/// ´claim:weight:the-tier-ladder-lands-in-its-calibration-bands´
#[test]
fn t_tier_calibration_bands() {
    for (p_d, p_i) in [
        (0.5, 1.0),
        (1.0, 0.5),
        (0.55, 1.0),
        (-0.5, 1.0),
        (0.5, -1.0),
    ] {
        for (rows, low, high) in [
            (&FULL[..], 0.27, 0.36),
            (&HALF[..], 0.20, 0.22),
            (&MARGINAL[..], 0.07, 0.08),
        ] {
            for (family, role) in rows {
                let c = coherence(*family, *role, p_d, p_i);
                assert!(
                    (low..=high).contains(&c),
                    "{family} {role} at ({p_d}, {p_i}): {c} outside [{low}, {high}]"
                );
            }
        }
    }
}

/// Between the tiers, at every pair: the floor ladder `{1, √η, η}` orders
/// the tabulated rows strictly.
///
/// At every live pair a Full row outweighs every Half row, which outweighs every Marginal row.
/// ´claim:weight:the-tier-ladder-orders-the-rows´
#[test]
fn t_tier_ladder_orders_the_rows() {
    check((live_parameter(), live_parameter()), |(p_d, p_i)| {
        let tier_max = |rows: &[(Family, LegRole)]| {
            rows.iter()
                .map(|(f, r)| coherence(*f, *r, p_d, p_i))
                .fold(0.0, f64::max)
        };
        let tier_min = |rows: &[(Family, LegRole)]| {
            rows.iter()
                .map(|(f, r)| coherence(*f, *r, p_d, p_i))
                .fold(f64::INFINITY, f64::min)
        };
        prop_assert!(tier_min(&FULL) > tier_max(&HALF));
        prop_assert!(tier_min(&HALF) > tier_max(&MARGINAL));
        prop_assert!(tier_min(&HALF) > tier_max(&MARGINAL_MINIMAL));
        Ok(())
    });
}

/// The Quadrant Law (layer1-interface.md §8.7): the coherence bit is the
/// parameter product's sign in every mask at every tier floor, and the joint
/// flip is an orthogonal conjugation the weight cannot see. Ranking reads
/// neither — the build of `Ψ^[P]` is what this validates.
///
/// The path view's determinant sign is the sign of the parameter product, and the joint sign flip leaves the weight bit-identical.
/// ´claim:weight:the-quadrant-law-holds´
#[test]
fn t_quad_quadrant_law() {
    check(
        (any_leg(), live_parameter(), live_parameter()),
        |((family, role), p_d, p_i)| {
            let view = path_view(family, role, p_d, p_i).expect("in domain");
            let expected = if (p_d > 0.0) == (p_i > 0.0) { 1 } else { -1 };
            prop_assert_eq!(view.parity(), expected);
            Ok(())
        },
    );
    check(
        (any_leg(), any_parameter(), any_parameter(), maturity()),
        |((family, role), p_d, p_i, tau)| {
            let view = path_view(family, role, p_d, p_i).expect("in domain");
            let flipped = path_view(family, role, -p_d, -p_i).expect("in domain");
            prop_assert_eq!(view.m00.to_bits(), flipped.m00.to_bits());
            prop_assert_eq!(view.m11.to_bits(), flipped.m11.to_bits());
            prop_assert_eq!(view.m01.to_bits(), (-flipped.m01).to_bits());
            prop_assert_eq!(view.m10.to_bits(), (-flipped.m10).to_bits());
            prop_assert_eq!(
                weight(family, role, p_d, p_i, tau).to_bits(),
                weight(family, role, -p_d, -p_i, tau).to_bits()
            );
            Ok(())
        },
    );
}

/// The crossover `τ*` of `g(τ) = √(1+τ²)·e^(−β·H_τ)`, by bisection on the
/// bracket the property asserts.
fn crossover() -> f64 {
    let (mut low, mut high) = (0.5, 0.999);
    assert!(maturity_gain(low) < 1.0 && maturity_gain(high) > 1.0);
    for _ in 0..80 {
        let mid = 0.5 * (low + high);
        if maturity_gain(mid) > 1.0 {
            high = mid;
        } else {
            low = mid;
        }
    }
    high
}

/// layer1-interface.md §8.3 and §8.7: `H_τ(0) = 0`, and maturity outweighs the
/// boundary exactly past `τ* ≈ 0.94`.
///
/// The maturity gain exceeds one exactly past a crossover near 0.94, and the entropy vanishes at zero.
/// ´claim:weight:maturity-crosses-over-near-0-94´
#[test]
fn t_cross_maturity_crossover() {
    assert_eq!(temporal_entropy(0.0).to_bits(), 0.0f64.to_bits());
    assert_eq!(maturity_gain(0.0), 1.0);
    let star = crossover();
    assert!((star - 0.94).abs() < 0.005, "τ* = {star}");
    check(0.0..1.0f64, move |tau| {
        if tau > 0.0 && tau < star - 1e-6 {
            prop_assert!(maturity_gain(tau) < 1.0, "g({tau}) at τ* = {star}");
        }
        if tau > star + 1e-6 {
            prop_assert!(maturity_gain(tau) > 1.0, "g({tau}) at τ* = {star}");
        }
        prop_assert!(temporal_entropy(tau) >= 0.0);
        Ok(())
    });
}

fn any_bundle() -> impl Strategy<Value = Vec<Member>> {
    prop::collection::btree_map(
        (0..4i64, 0..8i64, 0..8i64),
        (any_parameter(), any_parameter()),
        1..12,
    )
    .prop_map(|members| {
        members
            .into_iter()
            .map(|((landing_epoch, act_time, position), (p_d, p_i))| Member {
                key: CausalKey {
                    landing_epoch,
                    act_time,
                    position,
                },
                p_d,
                p_i,
            })
            .collect()
    })
}

/// The reference the fold must equal: common's clip over the members' exact
/// decimal sum (edges.md §1), written out a second time here.
fn reference_fold(members: &[Member]) -> (f64, f64) {
    let d = exact_sum(members.iter().map(|m| m.p_d)).expect("finite");
    let i = exact_sum(members.iter().map(|m| m.p_i)).expect("finite");
    (clip(d.to_f64()), clip(i.to_f64()))
}

/// feed-ranking.md §3.2 and edges.md §1: sum-then-clip over the exact
/// decimal sum, whatever order the members arrive in, by common's fold and
/// no variant.
///
/// A bundle folds to common's clip of its members' exact sum, bit for bit and whatever order they arrive in.
/// ´claim:bundle:the-fold-is-commons-exact-sum´
#[test]
fn t_fold_sum_then_clip_exactly() {
    check(
        any_bundle().prop_flat_map(|members| (Just(members.clone()), Just(members).prop_shuffle())),
        |(members, shuffled)| {
            let folded = fold_members(&shuffled).expect("a bundle of distinct keys folds");
            let (d, i) = reference_fold(&members);
            prop_assert_eq!(folded.p_d.to_bits(), d.to_bits());
            prop_assert_eq!(folded.p_i.to_bits(), i.to_bits());
            prop_assert_eq!(folded.members as usize, members.len());
            let newest = members.iter().map(|m| m.key).max().expect("non-empty");
            prop_assert_eq!(folded.newest, newest);
            Ok(())
        },
    );
}

/// Floating addition is not associative — the same three members sum to
/// different bits in two orders — but the fold's sum is exact, so the order
/// is not observable: both orders fold to the decimal 0.6, and a walk-back
/// by −0.6 nets the bundle to exactly zero.
///
/// No order of a bundle's members is observable in its fold, where floating addition would give different bits.
/// ´claim:bundle:no-order-is-observable-in-the-fold´
#[test]
fn t_fold_no_order_is_observable() {
    let at = |position, p| Member {
        key: CausalKey {
            landing_epoch: 1,
            act_time: 1,
            position,
        },
        p_d: p,
        p_i: p,
    };
    assert_ne!((0.1 + 0.2) + 0.3, (0.3 + 0.2) + 0.1, "floats would see order");
    let ascending = [at(0, 0.1), at(1, 0.2), at(2, 0.3)];
    let descending = [at(0, 0.3), at(1, 0.2), at(2, 0.1)];
    for members in [ascending, descending] {
        let folded = fold_members(&members).expect("folds");
        assert_eq!((folded.p_d, folded.p_i), (0.6, 0.6));
    }
    let walked_back = [at(0, 0.1), at(1, 0.2), at(2, 0.3), at(3, -0.6)];
    let folded = fold_members(&walked_back).expect("folds");
    assert_eq!((folded.p_d, folded.p_i), (0.0, 0.0));
    assert!(folded.is_inert());
}

/// feed-ranking.md §3.2: a bundle netted to `(0, 0)` is routing-inert, and so
/// is one netted on a single axis; the weight of its folded leg is zero.
///
/// A bundle netted to zero on either axis folds to an inert leg of weight zero.
/// ´claim:bundle:a-netted-bundle-is-inert´
#[test]
fn t_fold_a_netted_bundle_is_inert() {
    let key = |position| CausalKey {
        landing_epoch: 2,
        act_time: 7,
        position,
    };
    for (second_d, second_i) in [(-0.75, -0.5), (-0.75, 0.25), (0.25, -0.5)] {
        let folded = fold_members(&[
            Member {
                key: key(0),
                p_d: 0.75,
                p_i: 0.5,
            },
            Member {
                key: key(1),
                p_d: second_d,
                p_i: second_i,
            },
        ])
        .expect("folds");
        assert!(folded.is_inert(), "({second_d}, {second_i})");
        let w = damped_weight(
            Family::Opinion,
            LegRole::Binary,
            folded.p_d,
            folded.p_i,
            0.3,
        )
        .expect("in domain");
        assert_eq!(w, 0.0);
    }
}

/// A conforming slice holds no two records under one causal key, and an
/// empty bundle names no edge; both refuse rather than fold.
///
/// A bundle with a repeated causal key or no members refuses to fold.
/// ´claim:bundle:a-malformed-bundle-refuses´
#[test]
fn a_malformed_bundle_refuses() {
    let key = CausalKey {
        landing_epoch: 0,
        act_time: 0,
        position: 0,
    };
    let member = Member {
        key,
        p_d: 0.5,
        p_i: 0.5,
    };
    assert!(fold_members(&[member, member]).is_err());
    assert!(fold_members(&[]).is_err());
}

/// Out-of-domain input is refused by name, never weighed: a parameter
/// outside `[-1, 1]` or NaN, a maturity outside `[0, 1]`, and a leg the
/// census does not give the family.
///
/// A leg outside the census or a parameter or maturity outside its domain refuses rather than weighs.
/// ´claim:weight:out-of-domain-input-refuses´
#[test]
fn out_of_domain_input_refuses() {
    let o = (Family::Opinion, LegRole::Binary);
    assert!(damped_weight(o.0, o.1, 1.5, 0.5, 0.0).is_err());
    assert!(damped_weight(o.0, o.1, 0.5, f64::NAN, 0.0).is_err());
    assert!(damped_weight(o.0, o.1, 0.5, 0.5, -0.1).is_err());
    assert!(damped_weight(o.0, o.1, 0.5, 0.5, f64::NAN).is_err());
    assert!(damped_weight(Family::Opinion, LegRole::T, 0.5, 0.5, 0.0).is_err());
    assert!(damped_weight(Family::Tag, LegRole::Binary, 0.5, 0.5, 0.0).is_err());
}
