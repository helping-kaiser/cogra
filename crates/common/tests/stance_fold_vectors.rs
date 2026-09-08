//! Exports `stance-fold-vectors.json` (repo root) — the cross-language
//! golden vectors pinning the local stance fold both clients
//! re-implement: the clip, the landing a candidate pick produces against
//! a bundle's raw sums, and the severance batch that nets a bundle.
//!
//! The graph's arithmetic is the one place both clients admit to doing
//! the graph's maths (design.md §8.3), and until now each did it from its
//! own reading: three implementations of `clip(raw_sum + pick)` with
//! three different edge behaviours and nothing comparing them. This is
//! `client-crypto-vectors.json`'s mechanism applied to the arithmetic.
//!
//! EVERY PARAMETER TRAVELS AS RAW f64 BITS. JSON has no NaN, and a plain
//! `0.0` cannot say whether the reference answered `0.0` or `-0.0` —
//! which is exactly the distinction the clip exists to erase, so a
//! document that could not state it would pin nothing here.
//!
//! The default run asserts the committed file matches this crate;
//! `make fold-vectors` (UPDATE_STANCE_FOLD_VECTORS=1) rewrites it.

use std::path::Path;

use common::l1::fold::{BundleSum, clip};
use serde_json::{Value, json};

/// A float as the 16 hex digits of its IEEE-754 bit pattern, big-endian —
/// `f64::to_bits`, `Double.doubleToRawLongBits`, and a `DataView`'s
/// `getFloat64` all name the same 64 bits.
fn bits(x: f64) -> String {
    format!("{:016x}", x.to_bits())
}

fn pair(p_d: f64, p_i: f64) -> Value {
    json!({"pDirectedBits": bits(p_d), "pInterestBits": bits(p_i)})
}

/// The inputs the clip has to answer for: the range boundaries, the two
/// values `clamp` alone leaves outside the domain, and an ordinary
/// in-range value that must pass through untouched.
fn clip_vectors() -> Value {
    let cases = [
        ("zero", 0.0),
        ("negative zero", -0.0),
        ("in range", 0.4),
        ("in range, negative", -0.25),
        ("at the ceiling", 1.0),
        ("at the floor", -1.0),
        ("above the ceiling", 2.5),
        ("below the floor", -3.0),
        ("not a number", f64::NAN),
        ("infinite", f64::INFINITY),
        ("negatively infinite", f64::NEG_INFINITY),
    ];
    json!(
        cases
            .iter()
            .map(|(case, x)| json!({
                "case": case,
                "inputBits": bits(*x),
                "outputBits": bits(clip(*x)),
            }))
            .collect::<Vec<_>>()
    )
}

/// Where a pick lands a bundle, computed from the bundle's RAW sums — the
/// only input that carries the history a clipped fold has already lost.
/// The flags are read off the clipped landing, which is the number the
/// graph routes on.
fn landing_vectors() -> Value {
    let cases: [(&str, f64, f64, f64, f64); 9] = [
        ("an empty bundle taking a tap", 0.0, 0.0, 0.1, 0.1),
        ("a pick appends rather than replaces", 0.5, 0.5, 0.1, 0.1),
        ("a pick clipped at the ceiling", 0.9, 0.9, 1.0, 1.0),
        ("a counter-pick reaching severance", 1.0, 1.0, -1.0, -1.0),
        (
            "a counter-pick against a sum beyond the clip",
            5.0,
            5.0,
            -1.0,
            -1.0,
        ),
        (
            "a counter-pick that nets a sum beyond the clip",
            5.0,
            5.0,
            -5.0,
            -5.0,
        ),
        ("inert on the directed axis alone", 0.3, 0.4, -0.3, 0.0),
        ("inert on the interest axis alone", 0.4, 0.3, 0.0, -0.3),
        (
            "a landing that would carry a negative zero",
            0.3,
            0.3,
            -0.3,
            -0.3,
        ),
    ];
    json!(
        cases
            .iter()
            .map(|(case, raw_d, raw_i, pick_d, pick_i)| {
                let sum = BundleSum {
                    p_d: *raw_d,
                    p_i: *raw_i,
                    records: 1,
                };
                let landed = sum.project(*pick_d, *pick_i);
                json!({
                    "case": case,
                    "rawSum": pair(*raw_d, *raw_i),
                    "pick": pair(*pick_d, *pick_i),
                    "landing": pair(landed.p_d, landed.p_i),
                    "inert": landed.is_inert(),
                    "severed": landed.is_severed(),
                })
            })
            .collect::<Vec<_>>()
    )
}

/// The counter-records that net a bundle to `(0, 0)`, and the cost the
/// confirm surface quotes for them — one answer, so a client that only
/// quotes the number cannot disagree with the batch it prices.
fn severance_vectors() -> Value {
    let cases: [(&str, f64, f64); 6] = [
        ("an already-netted bundle", 0.0, 0.0),
        ("within one record's reach", 0.5, 0.5),
        ("at exactly one record", 1.0, -1.0),
        ("below one record", 0.05, 0.0),
        ("beyond one record", 2.5, -1.2),
        ("beyond one record, both axes", -3.4, 2.9),
    ];
    json!(
        cases
            .iter()
            .map(|(case, p_d, p_i)| {
                let sum = BundleSum {
                    p_d: *p_d,
                    p_i: *p_i,
                    records: 1,
                };
                json!({
                    "case": case,
                    "rawSum": pair(*p_d, *p_i),
                    "cost": sum.severance_cost(),
                    "batch": sum
                        .severance_batch()
                        .into_iter()
                        .map(|(d, i)| pair(d, i))
                        .collect::<Vec<_>>(),
                })
            })
            .collect::<Vec<_>>()
    )
}

fn build_vectors() -> Value {
    json!({
        "version": 1,
        "clip": clip_vectors(),
        "landings": landing_vectors(),
        "severance": severance_vectors(),
    })
}

/// A vector document that could not distinguish the two zeros would pass
/// against an implementation that never normalises, which is the defect
/// the clip exists to prevent.
///
/// The exported vectors distinguish a positive zero from a negative one.
/// ´claim:fold:the-vectors-distinguish-the-two-zeros´
#[test]
fn the_document_can_state_the_difference_between_the_zeros() {
    assert_ne!(bits(0.0), bits(-0.0));
    assert_eq!(bits(-0.0), "8000000000000000");
    let landed = BundleSum {
        p_d: 0.3,
        p_i: 0.3,
        records: 1,
    }
    .project(-0.3, -0.3);
    assert_eq!(
        bits(landed.p_d),
        bits(0.0),
        "a landing at zero is a positive zero"
    );
}

/// The committed fold vectors match what this crate derives, so drift fails the build rather than reaching a client.
/// ´claim:fold:the-committed-vectors-match-what-the-crate-derives´
#[test]
fn exported_fold_vectors_match_the_committed_file() {
    let rendered = format!(
        "{}\n",
        serde_json::to_string_pretty(&build_vectors()).expect("vectors serialize")
    );
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../stance-fold-vectors.json");
    if std::env::var_os("UPDATE_STANCE_FOLD_VECTORS").is_some() {
        std::fs::write(&path, rendered).expect("write stance-fold-vectors.json");
        return;
    }
    let committed = std::fs::read_to_string(&path)
        .expect("stance-fold-vectors.json is missing — run `make fold-vectors`");
    assert_eq!(
        committed, rendered,
        "stance-fold-vectors.json is stale — run `make fold-vectors`"
    );
}
