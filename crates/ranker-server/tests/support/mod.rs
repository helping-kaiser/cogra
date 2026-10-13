//! ´mod:module:support´
//!
//! A stub of the api the pod reads (ranker-core §7.3): an in-test axum
//! server answering the pod's three operations from a fixture slice, page
//! by page, and from a parameter table — and recording every `asOfEpoch`
//! the pod asked for, so the pin is observable.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use ranker::{CausalKey, Family, LegRole, NodeKind, Slice, SliceLeg, SliceNode, SliceRecord};
use ranker_server::api::ApiClient;
use serde_json::{Value, json};
use uuid::Uuid;

/// A CoGra id for a graph identifier: deterministic, so a fixture and its
/// assertions agree on it.
pub fn uuid_of(graph_id: &str) -> Uuid {
    Uuid::new_v5(&Uuid::NAMESPACE_URL, graph_id.as_bytes())
}

/// What the stub answers.
#[derive(Clone)]
pub struct Stub {
    pub slice: Option<Slice>,
    pub parameters: BTreeMap<String, String>,
    /// Answer every request with a broken body.
    pub broken: bool,
    pub pins: Arc<Mutex<Vec<Option<i64>>>>,
}

/// The genesis parameters as the api serializes them, the ruled
/// composition included.
pub fn genesis_parameters() -> BTreeMap<String, String> {
    [
        ("k", "8"),
        ("gamma", "1.0"),
        ("dust_floor", "0.0"),
        ("recency_half_life_epochs", "30"),
        ("recency_shape", "\"exponential\""),
        ("tie_breaker_composition", "[\"recency\"]"),
    ]
    .into_iter()
    .map(|(k, v)| (k.to_string(), v.to_string()))
    .collect()
}

fn page<T: Clone>(items: &[T], variables: &Value) -> (Vec<(usize, T)>, bool) {
    let first = variables["first"].as_u64().unwrap_or(20) as usize;
    let start = variables["after"]
        .as_str()
        .and_then(|c| c.parse::<usize>().ok())
        .map_or(0, |c| c + 1);
    let end = (start + first).min(items.len());
    let slice = (start..end).map(|i| (i, items[i].clone())).collect();
    (slice, end < items.len())
}

fn key_json(key: &CausalKey) -> Value {
    json!({"landingEpoch": key.landing_epoch, "actTime": key.act_time, "position": key.position})
}

fn node_json(node: &SliceNode) -> Value {
    json!({
        "graphId": node.graph_id,
        "id": node.id,
        "kind": node.kind.map(|k| k.wire_name()),
        "genesis": node.genesis.as_ref().map(key_json),
    })
}

fn record_json(record: &SliceRecord) -> Value {
    json!({
        "id": record.record_id,
        "family": record.family.wire_name(),
        "authorId": record.author,
        "landingEpoch": record.key.landing_epoch,
        "actTime": record.key.act_time,
        "position": record.key.position,
        "legs": record.legs.iter().map(|l| json!({
            "role": l.role.wire_name(),
            "sourceId": l.source,
            "targetId": l.target,
            "pDirected": l.p_d,
            "pInterest": l.p_i,
            "maturity": l.tau,
            "censusUnknown": l.census_unknown,
        })).collect::<Vec<_>>(),
    })
}

fn connection(items: Vec<(usize, Value)>, more: bool) -> Value {
    let end = items.last().map(|(i, _)| i.to_string());
    json!({
        "pageInfo": {"hasNextPage": more, "endCursor": end},
        "edges": items.into_iter().map(|(i, node)| json!({"cursor": i.to_string(), "node": node})).collect::<Vec<_>>(),
    })
}

async fn answer(State(stub): State<Stub>, Json(request): Json<Value>) -> Json<Value> {
    if stub.broken {
        return Json(json!({"not": "graphql"}));
    }
    let variables = &request["variables"];
    let operation = request["operationName"].as_str().unwrap_or_default();
    if operation == "RankingParameters" {
        let wanted: Vec<String> = variables["keys"]
            .as_array()
            .map(|keys| keys.iter().filter_map(|k| k.as_str().map(String::from)).collect())
            .unwrap_or_default();
        let read: Vec<Value> = stub
            .parameters
            .iter()
            .filter(|(k, _)| wanted.contains(k))
            .map(|(k, v)| json!({"key": k, "value": v}))
            .collect();
        return Json(json!({"data": {"networkParameters": read}}));
    }
    if let Ok(mut pins) = stub.pins.lock() {
        pins.push(variables["asOfEpoch"].as_i64());
    }
    let Some(slice) = stub.slice.as_ref().filter(|s| {
        variables["viewer"].as_str() == Some(s.viewer.as_str())
    }) else {
        return Json(json!({"data": {"feedSlice": null}}));
    };
    let as_of = variables["asOfEpoch"].as_i64().unwrap_or(slice.as_of_epoch);
    let body = if operation == "SliceNodes" {
        let (items, more) = page(&slice.nodes, variables);
        json!({"asOfEpoch": as_of, "nodes": connection(items.into_iter().map(|(i, n)| (i, node_json(&n))).collect(), more)})
    } else {
        let (items, more) = page(&slice.records, variables);
        json!({"asOfEpoch": as_of, "records": connection(items.into_iter().map(|(i, r)| (i, record_json(&r))).collect(), more)})
    };
    Json(json!({"data": {"feedSlice": body}}))
}

/// Serves the stub on a free local port and returns a client pointing at
/// it.
pub async fn serve(stub: Stub) -> ApiClient {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("a free port");
    let address = listener.local_addr().expect("bound");
    let app = Router::new().route("/graphql", post(answer)).with_state(stub);
    tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });
    ApiClient::new(&format!("http://{address}/graphql"), Duration::from_secs(10)).expect("a client")
}

/// Builds fixture slices the way Layer 1 publishes records.
pub struct Builder {
    pub epoch: i64,
    pub tau: f64,
    clock: i64,
    seq: BTreeMap<String, u64>,
    nodes: BTreeMap<String, SliceNode>,
    records: Vec<SliceRecord>,
}

impl Builder {
    pub fn new() -> Builder {
        let mut b = Builder {
            epoch: 1,
            tau: 0.5,
            clock: 0,
            seq: BTreeMap::new(),
            nodes: BTreeMap::new(),
            records: Vec::new(),
        };
        b.person("v");
        b
    }

    fn key(&mut self) -> CausalKey {
        self.clock += 1;
        CausalKey {
            landing_epoch: self.epoch,
            act_time: self.clock,
            position: self.clock,
        }
    }

    fn act(&mut self, author: &str, token: &str) -> String {
        let seq = self.seq.entry(author.to_string()).or_insert(0);
        *seq += 1;
        format!("act:{author}:{seq}:{token}")
    }

    fn node(&mut self, graph_id: &str, kind: NodeKind, genesis: Option<CausalKey>) {
        self.nodes.insert(
            graph_id.to_string(),
            SliceNode {
                graph_id: graph_id.to_string(),
                id: Some(uuid_of(graph_id).to_string()),
                kind: Some(kind),
                genesis,
                statistics: None,
            },
        );
    }

    pub fn person(&mut self, atom: &str) -> String {
        let key = self.key();
        let graph_id = format!("prof:{atom}");
        self.node(&graph_id, NodeKind::User, Some(key));
        graph_id
    }

    fn push(&mut self, family: Family, author: &str, legs: Vec<(LegRole, String, String, f64, f64)>) -> String {
        let token = match family {
            Family::Publish => "publish",
            Family::Opinion => "opinion",
            Family::Participant => "participant",
            _ => "other",
        };
        let record_id = self.act(author, token);
        let key = self.key();
        self.records.push(SliceRecord {
            record_id: record_id.clone(),
            family,
            author: author.to_string(),
            key,
            legs: legs
                .into_iter()
                .map(|(role, source, target, p_d, p_i)| SliceLeg {
                    role,
                    source,
                    target,
                    p_d,
                    p_i,
                    tau: self.tau,
                    census_unknown: false,
                })
                .collect(),
        });
        record_id
    }

    pub fn post(&mut self, author: &str) -> String {
        let next = self.seq.get(author).copied().unwrap_or(0) + 1;
        let graph_id = format!("mint:act:{author}:{next}:publish");
        self.push(
            Family::Publish,
            author,
            vec![(LegRole::Binary, format!("addr:{author}"), graph_id.clone(), 1.0, 1.0)],
        );
        let genesis = self.records.last().map(|r| r.key);
        self.node(&graph_id, NodeKind::Post, genesis);
        graph_id
    }

    pub fn opinion(&mut self, author: &str, target: &str, p_d: f64, p_i: f64) {
        self.push(
            Family::Opinion,
            author,
            vec![(LegRole::Binary, format!("addr:{author}"), target.to_string(), p_d, p_i)],
        );
    }

    /// A chat movement record — a family the ranker refuses until slice 5.
    pub fn participant(&mut self, author: &str) -> String {
        let chat = format!("mint:act:{author}:900:participant");
        self.nodes.insert(
            chat.clone(),
            SliceNode {
                graph_id: chat.clone(),
                id: None,
                kind: None,
                genesis: None,
                statistics: None,
            },
        );
        self.push(
            Family::Participant,
            author,
            vec![
                (LegRole::A, format!("addr:{author}"), chat.clone(), 1.0, 1.0),
                (LegRole::T, chat.clone(), chat, 1.0, 1.0),
            ],
        )
    }

    pub fn build(&self, as_of_epoch: i64) -> Slice {
        Slice {
            as_of_epoch,
            viewer: uuid_of("prof:v").to_string(),
            nodes: self.nodes.values().cloned().collect(),
            records: self.records.clone(),
        }
    }
}

/// A slice wide enough to page: the viewer opines on many people, each of
/// whom publishes.
pub fn wide_slice(people: usize) -> Slice {
    let mut b = Builder::new();
    for i in 0..people {
        let atom = format!("p{i}");
        b.person(&atom);
        b.epoch = 1 + (i as i64 % 5);
        b.tau = [1.0 / 3.0, 2.0 / 3.0, 6.0 / 7.0, 0.1][i % 4];
        let sign = if i % 7 == 0 { -0.5 } else { 0.75 };
        b.opinion("v", &format!("prof:{atom}"), sign, 0.5 + (i % 3) as f64 * 0.25);
        b.post(&atom);
    }
    b.build(9)
}
