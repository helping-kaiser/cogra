//! The pod's GraphQL surface against a stub api (ranker-core §5, §7.3):
//! every fault code it answers, the pin it ranks over, and an answer an
//! independent spot-check accepts bit for bit.

mod support;

use std::io::Write;
use std::sync::{Arc, Mutex};

use async_graphql::Request;
use ranker::{
    CausalKey, Family, FeedEntry, HopMember, LegRole, NetworkParams, NodeKind, RankHop, RankParams,
    RankPath, RecencyShape, SpotCheck, TieBreakerKey, TieBreakers, score_target, spot_check,
};
use ranker_server::schema;
use serde_json::{Value, json};
use support::{Builder, Stub, genesis_parameters, serve, uuid_of, wide_slice};

const RANK: &str = r#"
query Rank($viewer: UUID!, $params: RankParams!, $asOfEpoch: Int) {
  rank(viewer: $viewer, params: $params, asOfEpoch: $asOfEpoch) {
    asOfEpoch
    entries {
      targetId targetKind score mark newestIndex
      tieBreakers { netStance grossVolume genesisEpochAge }
      paths {
        nodeIds sign magnitude recency contribution
        hops {
          family role authorId sourceId targetId recordIds pDirected pInterest maturity weight
          members { recordId landingEpoch actTime position pDirected pInterest maturity }
        }
      }
    }
    settling { ref mark rankedPosition newestPosition }
  }
}
"#;

fn stub(slice: Option<ranker::Slice>) -> Stub {
    Stub {
        slice,
        parameters: genesis_parameters(),
        broken: false,
        pins: Arc::new(Mutex::new(Vec::new())),
    }
}

async fn run(stub: Stub, params: Value, as_of_epoch: Option<i64>) -> Value {
    let api = serve(stub).await;
    let request = Request::new(RANK).variables(async_graphql::Variables::from_json(json!({
        "viewer": uuid_of("prof:v"),
        "params": params,
        "asOfEpoch": as_of_epoch,
    })));
    serde_json::to_value(schema::build(api).execute(request).await).expect("an answer serializes")
}

fn code(answer: &Value) -> Option<String> {
    answer["errors"][0]["extensions"]["code"].as_str().map(String::from)
}

/// A log sink the test can read back.
#[derive(Clone, Default)]
struct Captured(Arc<Mutex<Vec<u8>>>);

impl Write for Captured {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        if let Ok(mut buffer) = self.0.lock() {
            buffer.extend_from_slice(bytes);
        }
        Ok(bytes.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl Captured {
    fn text(&self) -> String {
        self.0
            .lock()
            .map(|b| String::from_utf8_lossy(&b).to_string())
            .unwrap_or_default()
    }
}

fn capture() -> (Captured, tracing::subscriber::DefaultGuard) {
    let sink = Captured::default();
    let writer = sink.clone();
    let subscriber = tracing_subscriber::fmt()
        .with_writer(move || writer.clone())
        .with_ansi(false)
        .finish();
    (sink, tracing::subscriber::set_default(subscriber))
}

/// ranker-core §5: `gamma` outside `(0, 1]` is the caller's fault.
///
/// A gamma outside its range is refused as bad input.
/// ´claim:pod:gamma-out-of-range-is-bad-input´
#[tokio::test]
async fn gamma_out_of_range_is_bad_input() {
    for gamma in [0.0, 1.5, -0.25] {
        let answer = run(stub(Some(wide_slice(3))), json!({"gamma": gamma}), None).await;
        assert_eq!(code(&answer).as_deref(), Some("BAD_INPUT"), "{gamma}");
    }
}

/// "finer only" (feed-ranking.md §12): a dust floor above the network's is
/// refused.
///
/// A dust floor coarser than the network's is refused as bad input.
/// ´claim:pod:a-coarser-dust-floor-is-bad-input´
#[tokio::test]
async fn dust_floor_coarser_than_network_is_bad_input() {
    let answer = run(stub(Some(wide_slice(3))), json!({"dustFloor": 0.25}), None).await;
    assert_eq!(code(&answer).as_deref(), Some("BAD_INPUT"));
}

/// A negative half-life names no recency.
///
/// A negative half-life is refused as bad input.
/// ´claim:pod:a-negative-half-life-is-bad-input´
#[tokio::test]
async fn negative_half_life_is_bad_input() {
    let answer = run(stub(Some(wide_slice(3))), json!({"recencyHalfLifeEpochs": -1}), None).await;
    assert_eq!(code(&answer).as_deref(), Some("BAD_INPUT"));
}

/// The reorder is post-MVP (PR-18) and a settling family must be a census
/// family: both are refused rather than ignored.
///
/// An enabled friend-fresh reorder or an unknown settling family is refused as bad input.
/// ´claim:pod:unbuilt-or-unknown-inputs-are-bad-input´
#[tokio::test]
async fn an_unbuilt_reorder_or_unknown_family_is_bad_input() {
    let enabled = json!({"friendAuthorReorder": {"enabled": true}});
    assert_eq!(code(&run(stub(Some(wide_slice(3))), enabled, None).await).as_deref(), Some("BAD_INPUT"));
    let unknown = json!({"settling": [{
        "ref": uuid_of("pending"), "author": "prof:p0", "family": "nonesuch",
        "pDirected": 1.0, "pInterest": 1.0, "authoredAt": "2026-10-13T00:00:00Z",
    }]});
    assert_eq!(code(&run(stub(Some(wide_slice(3))), unknown, None).await).as_deref(), Some("BAD_INPUT"));
    let disabled = json!({"friendAuthorReorder": {"enabled": false}});
    assert!(code(&run(stub(Some(wide_slice(3))), disabled, None).await).is_none());
}

/// api-spec `feedSlice`: "Null if the id resolves to no rankable actor".
///
/// A viewer the api resolves to no rankable actor is not found.
/// ´claim:pod:an-unknown-viewer-is-not-found´
#[tokio::test]
async fn unknown_viewer_is_not_found() {
    let answer = run(stub(None), json!({}), None).await;
    assert_eq!(code(&answer).as_deref(), Some("NOT_FOUND"));
}

/// A slice the pod cannot read is no answer it could repair.
///
/// A failed slice fetch is internal.
/// ´claim:pod:a-failed-slice-fetch-is-internal´
#[tokio::test]
async fn slice_fetch_failure_is_internal() {
    let mut broken = stub(Some(wide_slice(3)));
    broken.broken = true;
    assert_eq!(code(&run(broken, json!({}), None).await).as_deref(), Some("INTERNAL"));
}

/// ranker-core §3.9: a family the ranker does not fold yet is internal,
/// and the record is logged.
///
/// A slice holding a family the ranker does not fold yet is internal, and the record is logged.
/// ´claim:pod:an-unsupported-family-is-internal-and-logged´
#[tokio::test]
async fn unsupported_family_is_internal_and_logged() {
    let (log, _guard) = capture();
    let mut b = Builder::new();
    b.person("x");
    b.opinion("v", "prof:x", 1.0, 1.0);
    let record = b.participant("x");
    let answer = run(stub(Some(b.build(3))), json!({}), None).await;
    assert_eq!(code(&answer).as_deref(), Some("INTERNAL"));
    assert!(log.text().contains(&record), "{}", log.text());
}

/// ranked-feed-api X-4: a composition naming a key the ruled vocabulary
/// lacks is refused loudly, never translated.
///
/// A tie-breaker composition that predates the ruling is refused loudly.
/// ´claim:pod:a-legacy-composition-is-refused-loudly´
#[tokio::test]
async fn a_legacy_tie_breaker_composition_is_refused_loudly() {
    let (log, _guard) = capture();
    let mut legacy = stub(Some(wide_slice(3)));
    legacy.parameters.insert(
        "tie_breaker_composition".into(),
        "[\"recency\",\"global_engagement\"]".into(),
    );
    let answer = run(legacy, json!({}), None).await;
    assert_eq!(code(&answer).as_deref(), Some("INTERNAL"));
    assert!(log.text().contains("predates PR-19"), "{}", log.text());
}

/// ranked-feed-api X-1 and X-7: a pinned call reads every page at the pin
/// and reports it; an unpinned one pins on its first page and reads every
/// later page there.
///
/// The pod ranks over the pinned epoch, and an unpinned call pins on its first page.
/// ´claim:pod:the-pod-ranks-over-the-pinned-epoch´
#[tokio::test]
async fn the_pod_ranks_over_the_pinned_epoch() {
    let pinned = stub(Some(wide_slice(160)));
    let pins = pinned.pins.clone();
    let answer = run(pinned, json!({}), Some(7)).await;
    assert_eq!(answer["data"]["rank"]["asOfEpoch"], 7);
    let seen = pins.lock().map(|p| p.clone()).unwrap_or_default();
    assert!(seen.len() >= 4, "nodes and records, two pages each: {seen:?}");
    assert!(seen.iter().all(|p| *p == Some(7)));
    let unpinned = stub(Some(wide_slice(160)));
    let pins = unpinned.pins.clone();
    let answer = run(unpinned, json!({}), None).await;
    assert_eq!(answer["data"]["rank"]["asOfEpoch"], 9);
    let seen = pins.lock().map(|p| p.clone()).unwrap_or_default();
    assert_eq!(seen[0], None);
    assert!(seen[1..].iter().all(|p| *p == Some(9)), "{seen:?}");
}

fn f(v: &Value) -> f64 {
    v.as_f64().expect("a number")
}

fn i(v: &Value) -> i64 {
    v.as_i64().expect("an integer")
}

fn s(v: &Value) -> String {
    v.as_str().expect("a string").to_string()
}

/// The pod's answer read back into the crate's types, so the crate's own
/// spot-check can judge it.
fn claimed(answer: &Value) -> Vec<FeedEntry> {
    answer["data"]["rank"]["entries"]
        .as_array()
        .expect("entries")
        .iter()
        .map(|e| {
            let paths: Vec<RankPath> = e["paths"]
                .as_array()
                .expect("paths")
                .iter()
                .map(|p| RankPath {
                    nodes: p["nodeIds"].as_array().expect("ids").iter().map(s).collect(),
                    hops: p["hops"]
                        .as_array()
                        .expect("hops")
                        .iter()
                        .map(|h| RankHop {
                            family: Family::from_wire(&s(&h["family"])).expect("a family"),
                            role: LegRole::from_wire(&s(&h["role"])).expect("a role"),
                            author: s(&h["authorId"]),
                            source: s(&h["sourceId"]),
                            target: s(&h["targetId"]),
                            members: h["members"]
                                .as_array()
                                .expect("members")
                                .iter()
                                .map(|m| HopMember {
                                    record_id: s(&m["recordId"]),
                                    key: CausalKey {
                                        landing_epoch: i(&m["landingEpoch"]),
                                        act_time: i(&m["actTime"]),
                                        position: i(&m["position"]),
                                    },
                                    p_d: f(&m["pDirected"]),
                                    p_i: f(&m["pInterest"]),
                                    tau: f(&m["maturity"]),
                                })
                                .collect(),
                            p_directed: f(&h["pDirected"]),
                            p_interest: f(&h["pInterest"]),
                            tau: f(&h["maturity"]),
                            weight: f(&h["weight"]),
                        })
                        .collect(),
                    sign: i(&p["sign"]) as i32,
                    magnitude: f(&p["magnitude"]),
                    recency: f(&p["recency"]),
                    contribution: f(&p["contribution"]),
                })
                .collect();
            FeedEntry {
                target_id: s(&e["targetId"]),
                target_graph_id: paths[0].nodes.last().cloned().expect("a target"),
                kind: NodeKind::from_wire(&s(&e["targetKind"])).expect("a kind"),
                score: f(&e["score"]),
                tie_breakers: TieBreakers {
                    net_stance: e["tieBreakers"]["netStance"].as_f64(),
                    gross_volume: e["tieBreakers"]["grossVolume"].as_f64(),
                    genesis_epoch_age: e["tieBreakers"]["genesisEpochAge"].as_i64(),
                },
                paths,
            }
        })
        .collect()
}

fn network() -> NetworkParams {
    NetworkParams {
        k: 8,
        gamma: 1.0,
        dust_floor: 0.0,
        half_life_epochs: 30,
        shape: RecencyShape::Exponential,
        tie_breakers: vec![TieBreakerKey::Recency],
    }
}

/// ranker-core §7.3: the pod's answer, read back off the wire, passes an
/// independent spot-check over the same fixture, and every entry equals
/// `score_target` alone, bit for bit.
///
/// The pod's answer passes an independent spot-check, and every entry equals the target scored alone.
/// ´claim:pod:the-pods-answer-passes-an-independent-spot-check´
#[tokio::test]
async fn pod_output_passes_an_independent_spot_check() {
    let slice = wide_slice(40);
    let params = json!({"kinds": ["POST", "USER"]});
    let answer = run(stub(Some(slice.clone())), params, None).await;
    assert!(answer["errors"].is_null(), "{answer}");
    let entries = claimed(&answer);
    assert!(entries.len() > 40);
    let rank_params = RankParams {
        kinds: Some(vec![NodeKind::Post, NodeKind::User]),
        ..RankParams::default()
    };
    let sample: Vec<String> = entries.iter().step_by(9).take(5).map(|e| e.target_id.clone()).collect();
    assert_eq!(
        spot_check(&slice, &rank_params, &network(), &entries, &sample).expect("checks"),
        SpotCheck::Clean
    );
    for entry in &entries {
        let alone = score_target(&slice, &entry.target_id, &rank_params, &network())
            .expect("scores")
            .expect("present");
        assert_eq!(alone.score.to_bits(), entry.score.to_bits());
        assert_eq!(format!("{:?}", alone.paths), format!("{:?}", entry.paths));
    }
    let mut tampered = entries.clone();
    tampered[0].score += 1e-9;
    assert!(matches!(
        spot_check(&slice, &rank_params, &network(), &tampered, &[tampered[0].target_id.clone()]).expect("checks"),
        SpotCheck::Mismatch { .. }
    ));
}

/// ranked-feed-api §4.10: settling candidates pass in and come back placed
/// in both woven orders.
///
/// Settling candidates whose author a live path reaches come back placed in both orders.
/// ´claim:pod:settling-candidates-come-back-placed´
#[tokio::test]
async fn settling_candidates_come_back_placed() {
    let params = json!({"settling": [
        {"ref": uuid_of("pending-1"), "author": "prof:p1", "family": "publish",
         "pDirected": 1.0, "pInterest": 1.0, "authoredAt": "2026-10-13T08:00:00Z"},
        {"ref": uuid_of("pending-2"), "author": "prof:nobody", "family": "publish",
         "pDirected": 1.0, "pInterest": 1.0, "authoredAt": "2026-10-13T09:00:00Z"},
    ]});
    let answer = run(stub(Some(wide_slice(5))), params, None).await;
    let placed = answer["data"]["rank"]["settling"].as_array().expect("places");
    assert_eq!(placed.len(), 1, "the unreached author's candidate is unplaced");
    assert_eq!(placed[0]["ref"], json!(uuid_of("pending-1")));
    assert_eq!(placed[0]["newestPosition"], 0);
}

/// ranker-core §4.1: `/health` is liveness.
///
/// The pod answers its liveness probe.
/// ´claim:pod:health-is-liveness´
#[tokio::test]
async fn health_answers_ok() {
    let api = serve(stub(None)).await;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.expect("a port");
    let address = listener.local_addr().expect("bound");
    tokio::spawn(async move {
        let _ = axum::serve(listener, ranker_server::app(schema::build(api))).await;
    });
    let body = reqwest::get(format!("http://{address}/health"))
        .await
        .expect("answers")
        .text()
        .await
        .expect("a body");
    assert_eq!(body, "{\"status\":\"ok\"}");
}

/// The checked-in `ranker-schema.graphql` is the schema the pod serves, so
/// the relay's generated client and the pod cannot drift apart.
///
/// The checked-in ranker schema is the one the pod exports.
/// ´claim:pod:the-checked-in-schema-is-the-pods´
#[test]
fn checked_in_ranker_schema_matches_the_pod() {
    let checked_in = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../../ranker-schema.graphql"))
        .expect("ranker-schema.graphql exists at the repo root (make ranker-schema)");
    assert_eq!(
        checked_in,
        schema::sdl(),
        "ranker-schema.graphql is stale — run `make ranker-schema` and commit the result"
    );
}
