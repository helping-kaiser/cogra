//! ´mod:module:pod´
//!
//! The stub ranker pod (ranked-feed-api §14.1 "The stub pod"): an in-test
//! HTTP server answering the pod's `rank` from a fixture, written against
//! the provisional `ranker-schema.graphql`. It mirrors ranker-core's stub
//! api from the other side, so the relay is tested before the pod exists.
//!
//! It answers whatever the test arms it with — an answer, a fault, a slow
//! or a held answer, or a call back into the api for the slice first — and
//! records every request it receives, so a test can read exactly what the
//! relay sent.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use api::ranker_pod::RankerConfig;
use axum::Json;
use axum::extract::State;
use axum::routing::post;
use serde_json::{Value, json};

/// What the pod does with the next requests.
#[derive(Clone)]
pub enum Mode {
    /// Answers `data.rank` with this value.
    Answer(Value),
    /// Answers a transport fault with this `extensions.code`.
    Fault(&'static str),
    /// Answers this raw JSON body, whatever it is.
    Raw(Value),
    /// Waits, then answers `data.rank` with the value.
    Slow(Duration, Value),
    /// Records the request and never answers.
    Hold,
    /// Reads the viewer's first slice page from the api at this url, as
    /// the real pod does, then answers `data.rank` with the value.
    FetchSliceThen(String, Value),
}

#[derive(Clone)]
struct Pod {
    mode: Arc<Mutex<Mode>>,
    requests: Arc<Mutex<Vec<Value>>>,
}

/// A running stub pod.
pub struct StubPod {
    pub url: String,
    pod: Pod,
}

impl StubPod {
    /// Starts a pod on an ephemeral local port.
    pub async fn start(mode: Mode) -> Self {
        let pod = Pod {
            mode: Arc::new(Mutex::new(mode)),
            requests: Arc::new(Mutex::new(Vec::new())),
        };
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind the stub pod");
        let url = format!(
            "http://{}/graphql",
            listener.local_addr().expect("stub pod address")
        );
        let app = axum::Router::new()
            .route("/graphql", post(answer))
            .with_state(pod.clone());
        tokio::spawn(async move {
            axum::serve(listener, app).await.expect("stub pod serves");
        });
        Self { url, pod }
    }

    /// The relay configuration that reaches this pod.
    pub fn config(&self) -> RankerConfig {
        RankerConfig {
            url: self.url.clone(),
            ..RankerConfig::default()
        }
    }

    pub fn set(&self, mode: Mode) {
        *self.pod.mode.lock().expect("mode") = mode;
    }

    /// Every request body received, in arrival order.
    pub fn requests(&self) -> Vec<Value> {
        self.pod.requests.lock().expect("requests").clone()
    }

    /// The last request's `variables`.
    pub fn last_variables(&self) -> Value {
        self.requests().last().expect("the pod was called")["variables"].clone()
    }
}

/// The pod's one route. A fixture without its own epoch ranks at the pin
/// it was asked for, as the real pod does; one that names an epoch keeps
/// it.
async fn answer(State(pod): State<Pod>, Json(request): Json<Value>) -> Json<Value> {
    let viewer = request["variables"]["viewer"].clone();
    let pin = request["variables"]["asOfEpoch"].clone();
    pod.requests.lock().expect("requests").push(request);
    let mode = pod.mode.lock().expect("mode").clone();
    let pinned = |mut rank: Value| {
        if rank.get("asOfEpoch").is_none() {
            rank["asOfEpoch"] = pin.clone();
        }
        rank
    };
    Json(match mode {
        Mode::Answer(rank) => json!({ "data": { "rank": pinned(rank) } }),
        Mode::Fault(code) => json!({
            "data": null,
            "errors": [{ "message": format!("stub {code}"), "extensions": { "code": code } }],
        }),
        Mode::Raw(body) => body,
        Mode::Slow(delay, rank) => {
            tokio::time::sleep(delay).await;
            json!({ "data": { "rank": pinned(rank) } })
        }
        Mode::Hold => {
            tokio::time::sleep(Duration::from_secs(3600)).await;
            Value::Null
        }
        Mode::FetchSliceThen(api_url, rank) => {
            let bytes = reqwest::Client::new()
                .post(&api_url)
                .header("content-type", "application/json")
                .body(
                    json!({
                        "query": "query($v: UUID!, $e: Int) { feedSlice(viewer: $v, asOfEpoch: $e) { asOfEpoch nodes(first: 100) { edges { node { graphId } } } } }",
                        "variables": { "v": viewer, "e": pin },
                    })
                    .to_string(),
                )
                .send()
                .await
                .expect("the api answers the slice")
                .bytes()
                .await
                .expect("the slice body");
            let slice: Value = serde_json::from_slice(&bytes).expect("a JSON slice");
            assert!(slice["errors"].is_null(), "the slice read faulted: {slice}");
            json!({ "data": { "rank": pinned(rank) } })
        }
    })
}

/// A pod answer, ranked at whatever epoch it is asked for: `entries` as
/// (targetId, kind, score, mark, newestIndex), `settling` as (ref, mark,
/// rankedPosition, newestPosition). Every entry carries the pod's
/// `tieBreakers`, which the relay must never pass on.
pub fn ranking(
    entries: &[(uuid::Uuid, &str, f64, Option<&str>, i64)],
    settling: &[(uuid::Uuid, Option<&str>, i64, i64)],
) -> Value {
    json!({
        "entries": entries.iter().map(|(id, kind, score, mark, newest)| json!({
            "targetId": id,
            "targetKind": kind,
            "score": score,
            "tieBreakers": { "netStance": 1.0, "grossVolume": 2.0, "genesisEpochAge": 3 },
            "mark": mark,
            "newestIndex": newest,
        })).collect::<Vec<_>>(),
        "settling": settling.iter().map(|(id, mark, ranked, newest)| json!({
            "ref": id,
            "mark": mark,
            "rankedPosition": ranked,
            "newestPosition": newest,
        })).collect::<Vec<_>>(),
    })
}
