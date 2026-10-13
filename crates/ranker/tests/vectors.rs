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
//! - `ranking` (set c): hand-built slices with their full ranked output —
//!   both reference channels, a Tag's topic leg, the person fold, a Type
//!   sink, a negative score, a cancellation, a strict-score tie.
//! - `costTies` (set d): equal path costs broken by the canonical hop key,
//!   the bundle's full-incidence key and leg role (RC-G2 (a)).
//!
//! EVERY FLOAT TRAVELS AS ITS IEEE-754 BIT PATTERN, the mechanism of
//! `stance-fold-vectors.json`: JSON has no NaN and cannot tell `0.0` from
//! `-0.0`, and a vector document that rounds through decimal pins nothing a
//! cross-platform difference would show.
//!
//! The default run asserts the committed file matches this crate;
//! `make ranker-vectors` (UPDATE_RANKER_VECTORS=1) rewrites it.

mod support;

use std::path::Path;

use ranker::{Family, FeedEntry, LegRole, damped_weight, path_view, rank, recency_factor};
use serde_json::{Value, json};
use support::{Case, bits, cost_tie_cases, entry_json, ranking_cases, slice_json};

fn ranked(case: &Case) -> Vec<FeedEntry> {
    rank(&case.slice, &case.params, &case.network).expect("a vector case ranks")
}

fn case_vectors(cases: Vec<Case>) -> Value {
    json!(
        cases
            .iter()
            .map(|case| json!({
                "case": case.name,
                "k": case.network.k,
                "kinds": case.params.kinds.as_ref().map(|ks| ks.iter().map(|k| k.wire_name()).collect::<Vec<_>>()),
                "slice": slice_json(&case.slice),
                "entries": ranked(case).iter().map(entry_json).collect::<Vec<_>>(),
            }))
            .collect::<Vec<_>>()
    )
}

fn nodes_of(entry: &FeedEntry) -> Vec<Vec<String>> {
    entry.paths.iter().map(|p| p.nodes.clone()).collect()
}

fn find<'a>(entries: &'a [FeedEntry], graph_id: &str) -> &'a FeedEntry {
    entries
        .iter()
        .find(|e| e.target_graph_id == graph_id)
        .unwrap_or_else(|| panic!("{graph_id} is ranked"))
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
        "ranking": case_vectors(ranking_cases()),
        "costTies": case_vectors(cost_tie_cases()),
    })
}

/// The vector cases rank as their names say: the expected output the JSON
/// pins is checked by hand here, path by path.
///
/// Every ranking vector case yields the paths, signs and order its name states.
/// ´claim:vectors:the-ranking-cases-rank-as-stated´
#[test]
fn the_ranking_cases_rank_as_stated() {
    let cases = ranking_cases();
    let all: Vec<Vec<FeedEntry>> = cases.iter().map(ranked).collect();

    let carrier = "mint:act:owner:1:publish";
    let cited = "mint:act:cited:1:publish";
    assert_eq!(
        nodes_of(find(&all[0], cited)),
        vec![vec!["prof:v", carrier, cited]]
    );

    assert_eq!(
        nodes_of(find(&all[1], cited)),
        vec![vec!["prof:v", "prof:referrer", carrier, cited]],
        "never from the carrier itself"
    );

    let tagged = find(&all[2], "name:rust");
    assert_eq!(
        nodes_of(tagged),
        vec![vec!["prof:v", "mint:act:writer:1:publish", "name:rust"]]
    );
    assert_eq!(
        tagged.tie_breakers.genesis_epoch_age, None,
        "a Type has no genesis"
    );

    let far = find(&all[3], "mint:act:far:1:publish");
    assert_eq!(
        nodes_of(far),
        vec![vec![
            "prof:v",
            "prof:friend",
            "prof:far",
            "mint:act:far:1:publish"
        ]]
    );
    assert_eq!(
        far.paths[0].hops[1].source, "prof:friend",
        "addr:friend reads as the person"
    );

    assert!(all[4].iter().any(|e| e.target_graph_id == "name:sink"));
    assert!(
        all[4]
            .iter()
            .all(|e| e.target_graph_id != "mint:act:stranger:1:publish")
    );

    let order: Vec<&str> = all[5].iter().map(|e| e.target_graph_id.as_str()).collect();
    assert_eq!(
        order,
        vec!["mint:act:rival:1:publish", "prof:rival"],
        "the strongest dislike last"
    );
    assert!(
        all[5].iter().all(|e| e.score < 0.0),
        "both reached through the dislike"
    );

    let cancelled = find(&all[6], "mint:act:x:1:publish");
    assert_eq!(cancelled.score.to_bits(), 0.0f64.to_bits());
    assert_eq!(cancelled.paths.len(), 2);

    let order: Vec<&str> = all[7].iter().map(|e| e.target_graph_id.as_str()).collect();
    assert_eq!(order, vec!["mint:act:y:1:publish", "mint:act:x:1:publish"]);
    assert_eq!(
        all[7][0].score.to_bits(),
        all[7][1].score.to_bits(),
        "a strict tie"
    );
}

/// RC-G2 (a): equal-cost paths extract in canonical hop-key order — alpha's
/// before beta's, though beta's records were written first — and at `k = 1`
/// the least key is the only path.
///
/// Equal-cost paths extract in the order of their hop keys, never of their records' arrival.
/// ´claim:vectors:cost-ties-break-by-hop-key´
#[test]
fn cost_ties_break_by_hop_key() {
    let cases = cost_tie_cases();
    let post = "mint:act:z:1:publish";
    let at_eight = ranked(&cases[0]);
    let entry = find(&at_eight, post);
    assert_eq!(
        nodes_of(entry),
        vec![
            vec!["prof:v", "prof:alpha", post],
            vec!["prof:v", "prof:beta", post],
        ]
    );
    assert_eq!(
        entry.paths[0].magnitude.to_bits(),
        entry.paths[1].magnitude.to_bits(),
        "an exact cost tie"
    );
    let at_one = ranked(&cases[1]);
    assert_eq!(
        nodes_of(find(&at_one, post)),
        vec![vec!["prof:v", "prof:alpha", post]]
    );
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
