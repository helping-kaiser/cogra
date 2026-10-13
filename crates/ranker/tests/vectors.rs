//! Exports `crates/ranker/tests/vectors/ranker-vectors.json` — the golden
//! vectors pinning the ranker's arithmetic bit for bit (ranker-core §7.1), so
//! every runner of the one formula — the pod today, a miner or a device
//! later, on another architecture — can prove it computes the same numbers.
//!
//! - `dampedWeight` (set a): `w̃` over every census leg, the four quadrants,
//!   both zero-parameter edges and the netted pair, at `τ = 0` and mid-range,
//!   and through the maturity crossover near 0.94.
//! - `recency` (set b): `f(Δt)` over the ages `{0, 1, h, 3h, large}`, a
//!   negative age, and the half-lives `{0, 1, 30}`.
//!
//! EVERY FLOAT TRAVELS AS ITS IEEE-754 BIT PATTERN, the mechanism of
//! `stance-fold-vectors.json`: JSON has no NaN and cannot tell `0.0` from
//! `-0.0`, and a vector document that rounds through decimal pins nothing a
//! cross-platform difference would show.
//!
//! The default run asserts the committed file matches this crate;
//! `make ranker-vectors` (UPDATE_RANKER_VECTORS=1) rewrites it.

use std::path::Path;

use ranker::{Family, LegRole, damped_weight, path_view, recency_factor};
use serde_json::{Value, json};

/// A float as the 16 hex digits of its IEEE-754 bit pattern, big-endian.
fn bits(x: f64) -> String {
    format!("{:016x}", x.to_bits())
}

fn every_leg() -> Vec<(Family, LegRole)> {
    Family::ALL
        .into_iter()
        .flat_map(|f| f.roles().into_iter().map(move |r| (f, r)))
        .collect()
}

fn weight_vector(family: Family, role: LegRole, p_d: f64, p_i: f64, tau: f64) -> Value {
    let view = path_view(family, role, p_d, p_i).expect("in domain");
    let weight = damped_weight(family, role, p_d, p_i, tau).expect("in domain");
    json!({
        "family": family.wire_name(),
        "role": role.wire_name(),
        "pDirectedBits": bits(p_d),
        "pInterestBits": bits(p_i),
        "tauBits": bits(tau),
        "coherenceBits": bits(view.coherence()),
        "weightBits": bits(weight),
    })
}

fn damped_weight_vectors() -> Value {
    let pairs = [
        (1.0, 1.0),
        (-1.0, 1.0),
        (1.0, -1.0),
        (-1.0, -1.0),
        (0.5, 0.25),
        (0.0, 0.5),
        (0.5, 0.0),
        (0.0, 0.0),
    ];
    let mut vectors = Vec::new();
    for (family, role) in every_leg() {
        for (p_d, p_i) in pairs {
            vectors.push(weight_vector(family, role, p_d, p_i, 0.0));
        }
        for (p_d, p_i) in [(1.0, 1.0), (0.5, 0.25)] {
            vectors.push(weight_vector(family, role, p_d, p_i, 0.5));
        }
    }
    for tau in [0.93, 0.9395, 0.94, 0.95, 0.99] {
        vectors.push(weight_vector(
            Family::Opinion,
            LegRole::Binary,
            1.0,
            1.0,
            tau,
        ));
    }
    json!(vectors)
}

fn recency_vectors() -> Value {
    let mut vectors = Vec::new();
    for half_life in [0u32, 1, 30] {
        let h = i64::from(half_life);
        for age in [-3, 0, 1, h, 3 * h, 10_000] {
            vectors.push(json!({
                "ageEpochs": age,
                "halfLifeEpochs": half_life,
                "factorBits": bits(recency_factor(age, half_life)),
            }));
        }
    }
    json!(vectors)
}

fn build_vectors() -> Value {
    json!({
        "version": 1,
        "dampedWeight": damped_weight_vectors(),
        "recency": recency_vectors(),
    })
}

/// A document that rounded its floats through decimal could not pin the
/// bit-identity the vectors exist for.
///
/// The exported vectors state every float as its exact bit pattern.
/// ´claim:vectors:every-float-travels-as-its-bits´
#[test]
fn the_document_states_floats_as_bits() {
    assert_eq!(bits(0.0), "0000000000000000");
    assert_eq!(bits(-0.0), "8000000000000000");
    assert_eq!(bits(1.0), "3ff0000000000000");
}

/// The committed vectors match what this crate derives, so drift fails the
/// build before it reaches another runner.
///
/// The committed ranker vectors match what the crate derives.
/// ´claim:vectors:the-committed-vectors-match-the-crate´
#[test]
fn exported_ranker_vectors_match_the_committed_file() {
    let rendered = format!(
        "{}\n",
        serde_json::to_string_pretty(&build_vectors()).expect("vectors serialize")
    );
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/vectors/ranker-vectors.json");
    if std::env::var_os("UPDATE_RANKER_VECTORS").is_some() {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).expect("create the vectors directory");
        }
        std::fs::write(&path, rendered).expect("write ranker-vectors.json");
        return;
    }
    let committed = std::fs::read_to_string(&path)
        .expect("ranker-vectors.json is missing — run `make ranker-vectors`");
    assert_eq!(
        committed, rendered,
        "ranker-vectors.json is stale — run `make ranker-vectors`"
    );
}
