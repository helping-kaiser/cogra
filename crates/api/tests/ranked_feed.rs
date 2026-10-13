//! The backend's part in ranking, end to end through the real HTTP
//! surface (api-spec.md "Feed"): the governed parameters a ranker reads
//! (`networkParameters`), the viewer's slice it ranks over (`feedSlice`),
//! and the hydration of the order it hands back (`feed`).
//!
//! The slice fixtures land records straight into the mirror, one epoch
//! package at a time, so each test names exactly the legs it walks.
//!
//! The relay (`feedRanking`) runs against the stub ranker pod
//! (`rig::pod`), which answers from fixtures and records what it was
//! sent: every relay test reads the request the pod received and the
//! answer the client got back, so the relay's whole part — translation and
//! carriage, never a computation — is visible at both ends.

mod rig;

use std::collections::{HashMap, HashSet};
use std::io::Read as _;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use api::bootstrap::{GenesisInput, run as bootstrap};
use api::ranker_pod::RankerConfig;
use api::ratelimit::RateLimitConfig;
use common::l1::Family;
use common::l1::census::LegRole;
use common::l1::handshake::{EpochPackage, PublishedLeg, PublishedRecord};
use common::l1::identifier::{ActId, NodeId};
use postgres_store::content::{self, LandingOrder};
use postgres_store::{genesis, hashtag, mirror};
use rig::WireRig;
use rig::pod::{Mode, StubPod, ranking};
use serde_json::{Value, json};
use sqlx::PgPool;
use std::collections::BTreeSet;
use uuid::Uuid;

const SLICE: &str = r#"query($viewer: UUID!, $asOf: Int, $dust: Float, $gamma: Float,
                            $first: Int, $after: String, $rfirst: Int) {
  feedSlice(viewer: $viewer, asOfEpoch: $asOf, dustFloor: $dust, gamma: $gamma) {
    asOfEpoch
    nodes(first: $first, after: $after) {
      totalCount
      edges { cursor node { graphId id kind genesis { landingEpoch actTime position } } }
      pageInfo { hasNextPage endCursor }
    }
    records(first: $rfirst) {
      totalCount
      edges { node {
        id family authorId landingEpoch
        legs { role sourceId targetId pDirected pInterest maturity censusUnknown }
      } }
      pageInfo { hasNextPage }
    }
  }
}"#;

const FEED: &str = r#"query($ids: [UUID!]!, $first: Int, $after: String) {
  feed(orderedIds: $ids, first: $first, after: $after) {
    edges { cursor node {
      __typename
      ... on Post { id }
      ... on Comment { id }
      ... on User { id }
      ... on Hashtag { id }
    } }
    pageInfo { hasNextPage hasPreviousPage endCursor }
  }
}"#;

const PARAMETERS: &str = r#"query($keys: [String!]) {
  networkParameters(keys: $keys) { key value asOfEpoch }
}"#;

fn rig(pool: PgPool) -> WireRig {
    WireRig::new(pool, RateLimitConfig::unlimited())
}

fn atom(handle: &str) -> String {
    format!("addr-{handle}")
}

fn addr(handle: &str) -> NodeId {
    NodeId::Addr(atom(handle))
}

fn prof(handle: &str) -> NodeId {
    NodeId::Prof(atom(handle))
}

fn act(handle: &str, seq: u64, family: Family) -> ActId {
    ActId::new(&atom(handle), seq, family).expect("act id")
}

fn minted(handle: &str, seq: u64, family: Family) -> NodeId {
    NodeId::Mint(act(handle, seq, family))
}

fn topic(name: &str) -> NodeId {
    NodeId::name(name).expect("type name")
}

/// One leg: role, ends, the leg's own parameters and maturity.
fn leg(role: LegRole, source: NodeId, target: NodeId, p: (f64, f64), tau: f64) -> PublishedLeg {
    PublishedLeg {
        role,
        source,
        target,
        p_d: p.0,
        p_i: p.1,
        tau,
    }
}

/// A binary act from `handle`'s actor to `target`.
fn binary(handle: &str, seq: u64, family: Family, target: NodeId) -> PublishedRecord {
    record(
        handle,
        seq,
        family,
        vec![leg(LegRole::Binary, addr(handle), target, (0.5, 0.5), 0.5)],
    )
}

fn record(handle: &str, seq: u64, family: Family, legs: Vec<PublishedLeg>) -> PublishedRecord {
    PublishedRecord {
        act_id: act(handle, seq, family),
        author: atom(handle),
        family,
        epoch: 0,
        act_time: 0,
        position: 0,
        payload_marked: false,
        payload_witness: vec![0; 32],
        legs,
    }
}

/// Lands `records` as the mirror's next epoch, in the given order.
async fn land(pool: &PgPool, records: Vec<PublishedRecord>) -> i64 {
    let epoch = mirror::last_ingested_epoch(pool).await.expect("cursor") + 1;
    let records = records
        .into_iter()
        .enumerate()
        .map(|(position, mut r)| {
            r.epoch = epoch;
            r.act_time = epoch * 100 + position as i64;
            r.position = position as i64;
            r
        })
        .collect();
    mirror::ingest_epoch(pool, &EpochPackage { epoch, records })
        .await
        .expect("ingests");
    epoch
}

async fn person(pool: &PgPool, handle: &str, kind: &str) -> Uuid {
    let id = Uuid::new_v4();
    let mut conn = pool.acquire().await.expect("conn");
    genesis::insert_actor(
        &mut conn,
        id,
        kind,
        handle,
        format!("pk-{handle}").as_bytes(),
        &atom(handle),
    )
    .await
    .expect("actor");
    id
}

async fn post_row(pool: &PgPool, author: Uuid, node: &NodeId, epoch: i64) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_post(
        &mut tx,
        id,
        author,
        &node.to_string(),
        "a=0;o=0",
        Some(LandingOrder {
            landed_epoch: epoch,
            act_time: epoch * 100,
            position: 0,
        }),
        chrono::DateTime::from_timestamp(1_800_000_000 + epoch, 0).expect("instant"),
        Some("a title"),
        None,
        "a body",
        None,
    )
    .await
    .expect("post");
    tx.commit().await.expect("commit");
    id
}

/// The fixture graph. `v` is the viewer.
///
/// - epoch 0: Registrations of v, a, b, x.
/// - epoch 1: v holds an opinion of a's Profile; a publishes P; a tags P
///   with `salt`; x stances v (inbound) and publishes Q; v withdraws
///   toward b, who publishes R; c reviews *out of* the Type `salt`.
/// - epoch 2: a reviews P (a hyper act minting comment K); v stances P
///   over a leg the census does not describe; a re-publishes P (an
///   edit); a mints a node CoGra carries no row for.
struct Fixture {
    viewer: Uuid,
    post: Uuid,
    p: NodeId,
}

async fn fixture(pool: &PgPool) -> Fixture {
    let viewer = person(pool, "v", "user").await;
    let a = person(pool, "a", "user").await;
    person(pool, "b", "user").await;
    person(pool, "x", "user").await;
    let p = minted("a", 1, Family::Publish);
    land(
        pool,
        ["v", "a", "b", "x"]
            .into_iter()
            .map(|h| binary(h, 0, Family::Registration, prof(h)))
            .collect(),
    )
    .await;
    let epoch = land(
        pool,
        vec![
            binary("v", 1, Family::Opinion, prof("a")),
            binary("a", 1, Family::Publish, p.clone()),
            record(
                "a",
                2,
                Family::Tag,
                vec![
                    leg(LegRole::A, addr("a"), p.clone(), (0.0, 1.0), 0.1),
                    leg(LegRole::T, p.clone(), topic("salt"), (1.0, 1.0), 0.1),
                ],
            ),
            binary("x", 1, Family::Opinion, prof("v")),
            binary("x", 2, Family::Publish, minted("x", 2, Family::Publish)),
            binary("v", 2, Family::Withdraw, prof("b")),
            binary("b", 1, Family::Publish, minted("b", 1, Family::Publish)),
            record(
                "c",
                1,
                Family::Review,
                vec![
                    leg(LegRole::A, addr("c"), topic("salt"), (0.5, 0.5), 0.2),
                    leg(
                        LegRole::T,
                        topic("salt"),
                        minted("c", 1, Family::Review),
                        (0.5, 0.5),
                        0.2,
                    ),
                ],
            ),
        ],
    )
    .await;
    let post = post_row(pool, a, &p, epoch).await;
    land(
        pool,
        vec![
            record(
                "a",
                3,
                Family::Review,
                vec![
                    leg(LegRole::A, addr("a"), p.clone(), (0.5, 0.25), 0.7),
                    leg(
                        LegRole::T,
                        p.clone(),
                        minted("a", 3, Family::Review),
                        (0.4, 0.1),
                        0.3,
                    ),
                ],
            ),
            record(
                "v",
                3,
                Family::Opinion,
                vec![leg(LegRole::A, addr("v"), p.clone(), (0.9, 0.9), 0.9)],
            ),
            binary("a", 4, Family::Publish, p.clone()),
            binary("a", 5, Family::Publish, minted("a", 5, Family::Publish)),
        ],
    )
    .await;
    Fixture { viewer, post, p }
}

async fn slice(rig: &WireRig, variables: Value) -> Value {
    rig.gql(None, SLICE, variables).await["feedSlice"].clone()
}

async fn full_slice(rig: &WireRig, viewer: Uuid) -> Value {
    slice(
        rig,
        json!({ "viewer": viewer, "first": 100, "rfirst": 100 }),
    )
    .await
}

fn node_ids(slice: &Value) -> BTreeSet<String> {
    slice["nodes"]["edges"]
        .as_array()
        .expect("node edges")
        .iter()
        .map(|e| e["node"]["graphId"].as_str().expect("graphId").to_string())
        .collect()
}

fn record_ids(slice: &Value) -> BTreeSet<String> {
    slice["records"]["edges"]
        .as_array()
        .expect("record edges")
        .iter()
        .map(|e| e["node"]["id"].as_str().expect("id").to_string())
        .collect()
}

fn node<'a>(slice: &'a Value, graph_id: &str) -> &'a Value {
    &slice["nodes"]["edges"]
        .as_array()
        .expect("node edges")
        .iter()
        .find(|e| e["node"]["graphId"] == graph_id)
        .unwrap_or_else(|| panic!("{graph_id} is a slice node"))["node"]
}

fn shipped<'a>(slice: &'a Value, record_id: &str) -> &'a Value {
    &slice["records"]["edges"]
        .as_array()
        .expect("record edges")
        .iter()
        .find(|e| e["node"]["id"] == record_id)
        .unwrap_or_else(|| panic!("{record_id} is shipped"))["node"]
}

fn codes(response: &Value) -> Vec<String> {
    response["errors"]
        .as_array()
        .map(|errors| {
            errors
                .iter()
                .map(|e| e["extensions"]["code"].as_str().unwrap_or("").to_string())
                .collect()
        })
        .unwrap_or_default()
}

fn genesis_input() -> GenesisInput {
    GenesisInput {
        handle: "operator".into(),
        display_name: "The Operator".into(),
        guidelines_version: "1".into(),
        guidelines_hash: "deadbeef".into(),
        burn_per_account_micro: 10_000_000,
    }
}

async fn parameters(rig: &WireRig, keys: Value) -> Vec<Value> {
    rig.gql(None, PARAMETERS, json!({ "keys": keys })).await["networkParameters"]
        .as_array()
        .expect("parameters")
        .clone()
}

fn keys_of(parameters: &[Value]) -> Vec<String> {
    parameters
        .iter()
        .map(|p| p["key"].as_str().expect("key").to_string())
        .collect()
}

/// After genesis every seeded parameter reads, ascending by key, with its
/// value serialized as JSON text.
///
/// Every parameter in force reads, ascending by key, its value as JSON text.
/// ´claim:params:every-parameter-reads´
#[sqlx::test(migrations = "../../migrations")]
async fn network_parameters_read_every_key(pool: PgPool) {
    let rig = rig(pool);
    bootstrap(&rig.standin, &rig.pool, genesis_input())
        .await
        .expect("genesis");
    let all = parameters(&rig, Value::Null).await;
    let keys = keys_of(&all);
    let mut sorted = keys.clone();
    sorted.sort();
    assert_eq!(keys, sorted, "ascending by key");
    assert_eq!(
        keys.len(),
        postgres_store::genesis::seeded_parameters(&rig.pool)
            .await
            .expect("seeded")
            .len()
    );
    let gamma = all.iter().find(|p| p["key"] == "gamma").expect("gamma");
    assert_eq!(gamma["value"], "1.0");
    let floor = all.iter().find(|p| p["key"] == "dust_floor").expect("χ");
    assert_eq!(floor["value"], "0.0");
}

/// RC-G4 (PR-65): the genesis composition names genesis recency alone; the
/// two statistics keys stay defined and governable, unseeded.
///
/// Genesis seeds the tie-breaker composition with recency alone.
/// ´claim:params:genesis-seeds-recency-alone´
#[sqlx::test(migrations = "../../migrations")]
async fn genesis_seeds_the_ruled_tie_breaker_order(pool: PgPool) {
    let rig = rig(pool);
    bootstrap(&rig.standin, &rig.pool, genesis_input())
        .await
        .expect("genesis");
    let read = parameters(&rig, json!(["tie_breaker_composition"])).await;
    assert_eq!(read.len(), 1);
    assert_eq!(read[0]["value"], "[\"recency\"]");
}

/// Named keys read exactly those parameters.
///
/// The named keys read exactly those parameters.
/// ´claim:params:named-keys-read-those´
#[sqlx::test(migrations = "../../migrations")]
async fn network_parameters_read_the_named_keys(pool: PgPool) {
    let rig = rig(pool);
    bootstrap(&rig.standin, &rig.pool, genesis_input())
        .await
        .expect("genesis");
    let named = parameters(&rig, json!(["gamma", "dust_floor"])).await;
    assert_eq!(keys_of(&named), vec!["dust_floor", "gamma"]);
}

/// A key the carrier never seeded is omitted, never an error.
///
/// An unknown key is omitted, never an error.
/// ´claim:params:an-unknown-key-is-omitted´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unknown_parameter_key_is_omitted(pool: PgPool) {
    let rig = rig(pool);
    bootstrap(&rig.standin, &rig.pool, genesis_input())
        .await
        .expect("genesis");
    let named = parameters(&rig, json!(["gamma", "no_such_parameter"])).await;
    assert_eq!(keys_of(&named), vec!["gamma"]);
}

/// An empty `keys` list asks for nothing, which is different from
/// asking for everything.
///
/// An empty key list reads empty.
/// ´claim:params:an-empty-key-list-reads-empty´
#[sqlx::test(migrations = "../../migrations")]
async fn an_empty_key_list_reads_empty(pool: PgPool) {
    let rig = rig(pool);
    bootstrap(&rig.standin, &rig.pool, genesis_input())
        .await
        .expect("genesis");
    assert!(parameters(&rig, json!([])).await.is_empty());
}

/// The genesis seed carries no landing of its own; its value comes from
/// the Charter's payload, so it reads the Charter's landing epoch. An
/// amended parameter reads the finalization it came from.
///
/// A never-amended parameter reads the Charter's landing epoch; an amended one reads its own.
/// ´claim:params:genesis-values-read-the-charters-epoch´
#[sqlx::test(migrations = "../../migrations")]
async fn a_never_amended_parameter_reads_the_charters_landing_epoch(pool: PgPool) {
    let rig = rig(pool);
    bootstrap(&rig.standin, &rig.pool, genesis_input())
        .await
        .expect("genesis");
    let charter = rig
        .gql(
            None,
            "{ records(family: PUBLISH, first: 1) { edges { node { landingEpoch } } } }",
            json!({}),
        )
        .await["records"]["edges"][0]["node"]["landingEpoch"]
        .as_i64()
        .expect("the Charter landed");
    sqlx::query(
        "INSERT INTO network_parameter_versions (parameter, value, landed_epoch, act_time, position)
         VALUES ('gamma', '0.9', 7, 700, 0)",
    )
    .execute(&rig.pool)
    .await
    .expect("amendment row");
    let read = parameters(&rig, json!(["dust_floor", "gamma"])).await;
    assert_eq!(read[0]["asOfEpoch"], charter);
    assert_eq!(read[1]["value"], "0.9");
    assert_eq!(read[1]["asOfEpoch"], 7);
}

/// Inbound records move nothing toward the viewer: x's stance at v is
/// never followed back to x or to what x published.
///
/// The slice follows records in their stored direction only.
/// ´claim:slice:forward-only´
#[sqlx::test(migrations = "../../migrations")]
async fn the_slice_never_follows_an_inbound_record(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let s = full_slice(&rig, f.viewer).await;
    let nodes = node_ids(&s);
    assert!(!nodes.contains(&prof("x").to_string()));
    assert!(!nodes.contains(&minted("x", 2, Family::Publish).to_string()));
    assert!(!record_ids(&s).contains(&act("x", 1, Family::Opinion).to_string()));
}

/// v's stance lands on a's Profile; a's Publish leaves from a's Actor.
/// One person, so the walk continues.
///
/// A person's Profile and Actor are one node: a stance on the Profile continues from the Actor.
/// ´claim:slice:persons-are-one-node´
#[sqlx::test(migrations = "../../migrations")]
async fn the_slice_crosses_a_person_from_profile_to_address(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let s = full_slice(&rig, f.viewer).await;
    let nodes = node_ids(&s);
    assert!(nodes.contains(&f.p.to_string()));
    assert!(record_ids(&s).contains(&act("a", 1, Family::Publish).to_string()));
    assert!(
        !nodes.contains(&addr("a").to_string()),
        "a person ships under the profile identifier only"
    );
}

/// The Type `salt` is reached through a's Tag, but c's Review leaving the
/// Type is never walked.
///
/// A Type is reached but never expanded.
/// ´claim:slice:types-are-sinks´
#[sqlx::test(migrations = "../../migrations")]
async fn the_slice_never_expands_out_of_a_type(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let s = full_slice(&rig, f.viewer).await;
    let nodes = node_ids(&s);
    assert!(nodes.contains(&topic("salt").to_string()));
    assert!(!nodes.contains(&minted("c", 1, Family::Review).to_string()));
    assert!(!record_ids(&s).contains(&act("c", 1, Family::Review).to_string()));
}

/// v's Withdraw toward b carries procedure, not stance.
///
/// A control record is never traversed or shipped.
/// ´claim:slice:control-records-never-expand´
#[sqlx::test(migrations = "../../migrations")]
async fn the_slice_never_expands_over_a_withdraw(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let s = full_slice(&rig, f.viewer).await;
    let nodes = node_ids(&s);
    assert!(!nodes.contains(&prof("b").to_string()));
    assert!(!nodes.contains(&minted("b", 1, Family::Publish).to_string()));
    assert!(!record_ids(&s).contains(&act("v", 2, Family::Withdraw).to_string()));
}

/// A ranker must find both ends of every leg it is shipped; a person's
/// `addr:` end is found under its `prof:` identifier.
///
/// Every leg endpoint of a shipped record is a slice node.
/// ´claim:slice:closed-over-shipped-legs´
#[sqlx::test(migrations = "../../migrations")]
async fn every_leg_endpoint_of_a_shipped_record_is_a_slice_node(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let s = full_slice(&rig, f.viewer).await;
    let nodes = node_ids(&s);
    let canonical = |id: &str| postgres_store::slice::canonical(id);
    let mut ends = 0;
    for edge in s["records"]["edges"].as_array().expect("records") {
        for l in edge["node"]["legs"].as_array().expect("legs") {
            for end in ["sourceId", "targetId"] {
                ends += 1;
                let id = canonical(l[end].as_str().expect("end"));
                assert!(nodes.contains(&id), "{id} is a slice node");
            }
        }
    }
    assert!(ends > 10, "the fixture ships legs: {ends}");
    assert_eq!(s["nodes"]["totalCount"], nodes.len());
    assert_eq!(
        s["records"]["totalCount"],
        s["records"]["edges"].as_array().expect("records").len()
    );
}

/// a's Review ships its A leg into P and its T leg out of P, each with
/// its own parameters and maturity.
///
/// A hyper-edge record ships both legs, each with its own parameters and maturity.
/// ´claim:slice:per-leg-wire´
#[sqlx::test(migrations = "../../migrations")]
async fn a_hyper_edge_record_ships_both_legs_with_their_own_parameters_and_maturity(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let s = full_slice(&rig, f.viewer).await;
    let review = shipped(&s, &act("a", 3, Family::Review).to_string());
    assert_eq!(
        review["legs"],
        json!([
            { "role": "A", "sourceId": addr("a").to_string(), "targetId": f.p.to_string(),
              "pDirected": 0.5, "pInterest": 0.25, "maturity": 0.7, "censusUnknown": false },
            { "role": "T", "sourceId": f.p.to_string(),
              "targetId": minted("a", 3, Family::Review).to_string(),
              "pDirected": 0.4, "pInterest": 0.1, "maturity": 0.3, "censusUnknown": false },
        ])
    );
}

/// The Publisher is a system actor: `author` is the contract's typed
/// view of it, `authorId` the raw address the fold keys on.
///
/// A record carries its raw author address, system actors included.
/// ´claim:slice:raw-author´
#[sqlx::test(migrations = "../../migrations")]
async fn a_system_authored_record_carries_its_raw_author(pool: PgPool) {
    let rig = rig(pool);
    let viewer = person(&rig.pool, "v", "user").await;
    person(&rig.pool, "sys", "system").await;
    land(
        &rig.pool,
        vec![
            binary("v", 1, Family::Opinion, prof("sys")),
            binary("sys", 1, Family::Publish, minted("sys", 1, Family::Publish)),
        ],
    )
    .await;
    let s = full_slice(&rig, viewer).await;
    let publish = shipped(&s, &act("sys", 1, Family::Publish).to_string());
    assert_eq!(publish["authorId"], atom("sys"));
    assert_eq!(node(&s, &prof("sys").to_string())["kind"], "USER");
}

/// a's fifth Publish mints a node CoGra has no post row for — as the
/// genesis Charter is. It still transits.
///
/// A node CoGra carries no row for ships with a null id and kind.
/// ´claim:slice:row-less-nodes-ship-untyped´
#[sqlx::test(migrations = "../../migrations")]
async fn a_row_less_mint_ships_with_null_id_and_kind(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let s = full_slice(&rig, f.viewer).await;
    let row_less = node(&s, &minted("a", 5, Family::Publish).to_string());
    assert_eq!(row_less["id"], Value::Null);
    assert_eq!(row_less["kind"], Value::Null);
    let typed = node(&s, &f.p.to_string());
    assert_eq!(typed["id"], f.post.to_string());
    assert_eq!(typed["kind"], "POST");
}

/// A Type's id is a pure function of its name, so it is typed whether
/// or not the registry holds it.
///
/// A Type ships with its name-derived id and the HASHTAG kind.
/// ´claim:slice:types-ship-their-uuid-v5´
#[sqlx::test(migrations = "../../migrations")]
async fn a_type_ships_with_its_uuid_v5_and_hashtag_kind(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let s = full_slice(&rig, f.viewer).await;
    let salt = node(&s, &topic("salt").to_string());
    assert_eq!(salt["id"], common::hashtag_uuid("salt").to_string());
    assert_eq!(salt["kind"], "HASHTAG");
}

/// A minted node's genesis is the act that minted it; a person's is
/// their Registration; a Type has none.
///
/// Slice nodes carry their genesis record's causal key, and a Type carries none.
/// ´claim:slice:genesis-keys´
#[sqlx::test(migrations = "../../migrations")]
async fn slice_nodes_carry_their_genesis_key_and_a_type_carries_none(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let s = full_slice(&rig, f.viewer).await;
    assert_eq!(
        node(&s, &f.p.to_string())["genesis"],
        json!({ "landingEpoch": 1, "actTime": 101, "position": 1 })
    );
    assert_eq!(
        node(&s, &prof("a").to_string())["genesis"],
        json!({ "landingEpoch": 0, "actTime": 1, "position": 1 })
    );
    assert_eq!(node(&s, &topic("salt").to_string())["genesis"], Value::Null);
}

/// a re-publishes P in epoch 2; P's genesis stays its minting act in
/// epoch 1.
///
/// An update record never moves a node's genesis key.
/// ´claim:slice:an-edit-keeps-the-genesis-key´
#[sqlx::test(migrations = "../../migrations")]
async fn an_edit_never_moves_a_nodes_genesis_key(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let s = full_slice(&rig, f.viewer).await;
    let edit = shipped(&s, &act("a", 4, Family::Publish).to_string());
    assert_eq!(edit["legs"][0]["targetId"], f.p.to_string());
    assert_eq!(edit["landingEpoch"], 2);
    assert_eq!(node(&s, &f.p.to_string())["genesis"]["landingEpoch"], 1);
}

/// v's Opinion arrived on a leg role its family's census row does not
/// describe; the mark rides the wire so every fold can skip it.
///
/// A leg ingested with fallback metadata ships its census-unknown mark.
/// ´claim:slice:census-mark-ships´
#[sqlx::test(migrations = "../../migrations")]
async fn a_census_unknown_leg_ships_its_mark(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let s = full_slice(&rig, f.viewer).await;
    let marked = shipped(&s, &act("v", 3, Family::Opinion).to_string());
    assert_eq!(marked["legs"][0]["censusUnknown"], true);
    let clean = shipped(&s, &act("v", 1, Family::Opinion).to_string());
    assert_eq!(clean["legs"][0]["censusUnknown"], false);
}

/// Paged at its epoch, a slice is one snapshot even while ingestion
/// appends reachable records between pages.
///
/// Pages read at one epoch are one slice, whatever lands between them.
/// ´claim:slice:pages-at-one-epoch-are-one-slice´
#[sqlx::test(migrations = "../../migrations")]
async fn slice_pages_read_at_one_epoch_are_one_slice_while_ingestion_appends(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let whole = full_slice(&rig, f.viewer).await;
    let pin = whole["asOfEpoch"].clone();
    let page = |after: Value| json!({ "viewer": f.viewer, "asOf": pin, "first": 3, "after": after, "rfirst": 1 });
    let mut seen = BTreeSet::new();
    let mut after = Value::Null;
    let mut pages = 0;
    loop {
        let s = slice(&rig, page(after)).await;
        seen.extend(node_ids(&s));
        pages += 1;
        if pages == 1 {
            land(
                &rig.pool,
                vec![binary(
                    "a",
                    9,
                    Family::Publish,
                    minted("a", 9, Family::Publish),
                )],
            )
            .await;
        }
        if s["nodes"]["pageInfo"]["hasNextPage"] != true {
            break;
        }
        after = s["nodes"]["pageInfo"]["endCursor"].clone();
    }
    assert!(pages > 1, "the slice paged");
    assert_eq!(seen, node_ids(&whole));
    assert!(!seen.contains(&minted("a", 9, Family::Publish).to_string()));
}

/// The same pin reads the same slice after more epochs land.
///
/// A slice re-read at its epoch is identical.
/// ´claim:slice:a-reread-at-its-epoch-is-identical´
#[sqlx::test(migrations = "../../migrations")]
async fn a_slice_reread_at_its_epoch_is_identical(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let before = full_slice(&rig, f.viewer).await;
    land(
        &rig.pool,
        vec![
            binary("v", 9, Family::Opinion, f.p.clone()),
            binary("a", 9, Family::Publish, minted("a", 9, Family::Publish)),
        ],
    )
    .await;
    let after = slice(
        &rig,
        json!({ "viewer": f.viewer, "asOf": before["asOfEpoch"], "first": 100, "rfirst": 100 }),
    )
    .await;
    assert_eq!(before, after);
    let unpinned = full_slice(&rig, f.viewer).await;
    assert_ne!(unpinned["asOfEpoch"], before["asOfEpoch"]);
}

/// Hydration serves the order it is handed — never its own — across
/// the kinds a feed row can be.
///
/// Feed hydrates the handed ids in the handed order.
/// ´claim:feed:hydrates-in-the-given-order´
#[sqlx::test(migrations = "../../migrations")]
async fn feed_hydrates_in_the_given_order(pool: PgPool) {
    let rig = rig(pool);
    let author = person(&rig.pool, "a", "user").await;
    let first = post_row(&rig.pool, author, &minted("a", 1, Family::Publish), 1).await;
    let second = post_row(&rig.pool, author, &minted("a", 2, Family::Publish), 2).await;
    let ids = json!([second, author, first]);
    let page = rig.gql(None, FEED, json!({ "ids": ids, "first": 2 })).await["feed"].clone();
    let served: Vec<&Value> = page["edges"]
        .as_array()
        .expect("edges")
        .iter()
        .map(|e| &e["node"]["id"])
        .collect();
    assert_eq!(served, vec![&json!(second), &json!(author)]);
    assert_eq!(page["edges"][1]["node"]["__typename"], "User");
    assert_eq!(page["pageInfo"]["hasNextPage"], true);
    let rest = rig
        .gql(
            None,
            FEED,
            json!({ "ids": ids, "first": 2, "after": page["pageInfo"]["endCursor"] }),
        )
        .await["feed"]
        .clone();
    assert_eq!(rest["edges"][0]["node"]["id"], json!(first));
    assert_eq!(rest["pageInfo"]["hasNextPage"], false);
    assert_eq!(rest["pageInfo"]["hasPreviousPage"], true);
}

/// A topic is a feed row but not a `Node`: it rides the union's own
/// member.
///
/// A topic hydrates as the union's Hashtag member.
/// ´claim:feed:a-topic-hydrates-as-a-hashtag´
#[sqlx::test(migrations = "../../migrations")]
async fn feed_hydrates_a_hashtag_as_a_union_member(pool: PgPool) {
    let rig = rig(pool);
    let mut conn = rig.pool.acquire().await.expect("conn");
    let salt = hashtag::upsert(&mut conn, "salt").await.expect("tag");
    drop(conn);
    let page = rig.gql(None, FEED, json!({ "ids": [salt] })).await["feed"].clone();
    assert_eq!(page["edges"][0]["node"]["__typename"], "Hashtag");
    assert_eq!(page["edges"][0]["node"]["id"], json!(salt));
}

/// A pending write that expired leaves an id that names nothing; the
/// window skips it rather than failing.
///
/// An id that resolves to nothing is skipped, never an error.
/// ´claim:feed:an-unresolvable-id-is-skipped´
#[sqlx::test(migrations = "../../migrations")]
async fn feed_skips_an_id_that_resolves_to_nothing(pool: PgPool) {
    let rig = rig(pool);
    let author = person(&rig.pool, "a", "user").await;
    let post = post_row(&rig.pool, author, &minted("a", 1, Family::Publish), 1).await;
    let page = rig
        .gql(None, FEED, json!({ "ids": [Uuid::new_v4(), post] }))
        .await["feed"]
        .clone();
    let edges = page["edges"].as_array().expect("edges");
    assert_eq!(edges.len(), 1);
    assert_eq!(edges[0]["node"]["id"], json!(post));
}

/// γ is a per-hop attenuation in (0, 1].
///
/// A gamma outside (0, 1] is BAD_INPUT.
/// ´claim:slice:gamma-out-of-range-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn slice_gamma_out_of_range_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    for gamma in [0.0, -0.5, 1.5] {
        let response = rig
            .gql_raw(None, SLICE, json!({ "viewer": f.viewer, "gamma": gamma }))
            .await;
        assert_eq!(codes(&response), vec!["BAD_INPUT"], "for {gamma}");
    }
}

/// A viewer may set χ only finer than the network's.
///
/// A dust floor coarser than the network's is BAD_INPUT.
/// ´claim:slice:a-coarser-dust-floor-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn slice_dust_floor_coarser_than_the_network_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let response = rig
        .gql_raw(None, SLICE, json!({ "viewer": f.viewer, "dust": 0.1 }))
        .await;
    assert_eq!(codes(&response), vec!["BAD_INPUT"]);
    let at_the_floor = slice(&rig, json!({ "viewer": f.viewer, "dust": 0.0 })).await;
    assert!(at_the_floor["asOfEpoch"].is_i64());
}

/// A negative χ is no floor at all.
///
/// A negative dust floor is BAD_INPUT.
/// ´claim:slice:a-negative-dust-floor-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn slice_negative_dust_floor_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let response = rig
        .gql_raw(None, SLICE, json!({ "viewer": f.viewer, "dust": -0.1 }))
        .await;
    assert_eq!(codes(&response), vec!["BAD_INPUT"]);
}

/// A pin names an ingested epoch; one past the cursor or below 0 names
/// nothing.
///
/// A slice pinned past the mirror cursor or below zero is BAD_INPUT.
/// ´claim:slice:a-pin-past-the-mirror-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn slice_pinned_past_the_mirror_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let cursor = mirror::last_ingested_epoch(&rig.pool)
        .await
        .expect("cursor");
    for pin in [cursor + 1, -1] {
        let response = rig
            .gql_raw(None, SLICE, json!({ "viewer": f.viewer, "asOf": pin }))
            .await;
        assert_eq!(codes(&response), vec!["BAD_INPUT"], "for {pin}");
    }
}

/// The slice's connections take the house page budget.
///
/// A slice page over the cap is BAD_INPUT.
/// ´claim:slice:over-the-page-cap-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn slice_records_over_the_page_cap_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    for variables in [
        json!({ "viewer": f.viewer, "rfirst": 101 }),
        json!({ "viewer": f.viewer, "first": 101 }),
    ] {
        let response = rig.gql_raw(None, SLICE, variables).await;
        assert!(
            codes(&response).contains(&"BAD_INPUT".to_string()),
            "{response}"
        );
    }
}

/// A hydration window is the house page budget: at most 100 ids.
///
/// A feed window of more than 100 ids is BAD_INPUT.
/// ´claim:feed:over-the-window-cap-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn feed_over_the_window_cap_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let ids: Vec<Uuid> = (0..101).map(|_| Uuid::new_v4()).collect();
    let response = rig.gql_raw(None, FEED, json!({ "ids": ids })).await;
    assert_eq!(codes(&response), vec!["BAD_INPUT"]);
    let ids: Vec<Uuid> = (0..100).map(|_| Uuid::new_v4()).collect();
    let at_the_cap = rig.gql(None, FEED, json!({ "ids": ids })).await;
    assert_eq!(at_the_cap["feed"]["edges"], json!([]));
}

/// The bound for a positive χ is not built; serving the plain closure
/// under one would claim a bound the slice never applied.
///
/// A positive network dust floor refuses the slice as INTERNAL.
/// ´claim:slice:a-positive-network-floor-refuses´
#[sqlx::test(migrations = "../../migrations")]
async fn a_positive_network_dust_floor_is_refused_loudly(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let mut conn = rig.pool.acquire().await.expect("conn");
    genesis::seed_parameter(&mut conn, "dust_floor", &json!(0.5))
        .await
        .expect("floor");
    drop(conn);
    let response = rig
        .gql_raw(None, SLICE, json!({ "viewer": f.viewer }))
        .await;
    assert_eq!(codes(&response), vec!["INTERNAL"]);
}

/// An unknown id, a keyless account, and an empty mirror all leave
/// nothing to rank from: null, not an error.
///
/// A viewer that resolves to no rankable actor reads a null slice.
/// ´claim:slice:an-unrankable-viewer-reads-null´
#[sqlx::test(migrations = "../../migrations")]
async fn slice_for_an_unknown_viewer_reads_null(pool: PgPool) {
    let rig = rig(pool);
    let empty = rig
        .gql(None, SLICE, json!({ "viewer": Uuid::new_v4() }))
        .await;
    assert_eq!(empty["feedSlice"], Value::Null);
    let f = fixture(&rig.pool).await;
    let unknown = rig
        .gql(None, SLICE, json!({ "viewer": Uuid::new_v4() }))
        .await;
    assert_eq!(unknown["feedSlice"], Value::Null);
    let keyless = Uuid::new_v4();
    sqlx::query("INSERT INTO actors (id, kind, handle) VALUES ($1, 'user', 'keyless')")
        .bind(keyless)
        .execute(&rig.pool)
        .await
        .expect("keyless actor");
    let keyless = rig.gql(None, SLICE, json!({ "viewer": keyless })).await;
    assert_eq!(keyless["feedSlice"], Value::Null);
    assert!(full_slice(&rig, f.viewer).await.is_object());
}

/// The client's whole selection (ranked-feed-api §12).
const RANKING: &str = r#"query($viewer: UUID!, $asOf: Int, $filter: FeedRankFilter) {
  feedRanking(viewer: $viewer, asOfEpoch: $asOf, filter: $filter) {
    asOfEpoch
    entries { targetId kind score mark newestIndex }
    settling { targetId kind mark rankedPosition newestPosition }
  }
}"#;

/// A rig whose `feedRanking` relays to a fresh stub pod in `mode`.
async fn pod_rig(pool: PgPool, mode: Mode) -> (WireRig, StubPod) {
    pod_rig_with(pool, mode, |_| {}).await
}

/// `pod_rig`, with the relay's configuration adjusted first.
async fn pod_rig_with(
    pool: PgPool,
    mode: Mode,
    adjust: impl FnOnce(&mut RankerConfig),
) -> (WireRig, StubPod) {
    let pod = StubPod::start(mode).await;
    let mut config = pod.config();
    adjust(&mut config);
    let rig = WireRig::with_ranker(pool, RateLimitConfig::unlimited(), &config);
    (rig, pod)
}

/// One `feedRanking` call, returned whole.
async fn rank_raw(rig: &WireRig, token: Option<&str>, variables: Value) -> Value {
    rig.gql_raw(token, RANKING, variables).await
}

/// One `feedRanking` call that must not fault; returns the answer.
async fn rank(rig: &WireRig, token: Option<&str>, variables: Value) -> Value {
    rig.gql(token, RANKING, variables).await["feedRanking"].clone()
}

fn ids_of(rows: &Value) -> Vec<Uuid> {
    rows.as_array()
        .expect("rows")
        .iter()
        .map(|row| {
            row["targetId"]
                .as_str()
                .expect("targetId")
                .parse()
                .expect("uuid")
        })
        .collect()
}

/// The settling candidates the pod was last sent.
fn sent_candidates(pod: &StubPod) -> Vec<Value> {
    pod.last_variables()["params"]["settling"]
        .as_array()
        .expect("candidates always ride")
        .clone()
}

fn sent_refs(pod: &StubPod) -> HashSet<Uuid> {
    sent_candidates(pod)
        .iter()
        .map(|c| c["ref"].as_str().expect("ref").parse().expect("uuid"))
        .collect()
}

async fn actor_id(pool: &PgPool, handle: &str) -> Uuid {
    genesis::actor_by_handle(pool, handle)
        .await
        .expect("lookup")
        .expect("the actor exists")
        .id
}

fn authored_at(secs: i64) -> chrono::DateTime<chrono::Utc> {
    chrono::DateTime::from_timestamp(1_900_000_000 + secs, 0).expect("instant")
}

/// One staged write in flight, past its pre-commitment, as the relay's
/// candidate read sees it.
#[expect(
    clippy::too_many_arguments,
    reason = "a staged row's columns, named where each fixture states them"
)]
async fn staged_row(
    pool: &PgPool,
    actor: Uuid,
    act: &ActId,
    family: Family,
    middle: Option<&str>,
    target: &str,
    p: (f64, f64),
    node: Option<Uuid>,
    secs: i64,
) {
    sqlx::query(
        "INSERT INTO staged_writes
             (id, actor_id, act_id, author, seq, family, middle, target, p_d, p_i,
              payload, prepared_epoch, node_id, state, pre_signed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ''::bytea, 0, $11,
                 'relaying', $12)",
    )
    .bind(Uuid::new_v4())
    .bind(actor)
    .bind(act.to_string())
    .bind(act.to_string().split(':').nth(1).expect("author"))
    .bind(
        act.to_string()
            .split(':')
            .nth(2)
            .expect("seq")
            .parse::<i64>()
            .expect("seq"),
    )
    .bind(family.as_str())
    .bind(middle)
    .bind(target)
    .bind(p.0)
    .bind(p.1)
    .bind(node)
    .bind(authored_at(secs))
    .execute(pool)
    .await
    .expect("staged write");
}

/// Content still settling: a pending post by `handle` (or, with `parent`,
/// a pending comment on it), minted by its own staged act with the edge
/// parameters `p`, authored at `secs`.
async fn settling_content(
    pool: &PgPool,
    handle: &str,
    seq: u64,
    parent: Option<Uuid>,
    p: (f64, f64),
    secs: i64,
) -> Uuid {
    settling_content_as(pool, Uuid::new_v4(), handle, seq, parent, p, secs).await
}

/// `settling_content` with the node's id chosen, for fixtures that order by
/// id bytes.
async fn settling_content_as(
    pool: &PgPool,
    id: Uuid,
    handle: &str,
    seq: u64,
    parent: Option<Uuid>,
    p: (f64, f64),
    secs: i64,
) -> Uuid {
    let author = actor_id(pool, handle).await;
    let family = if parent.is_some() {
        Family::Review
    } else {
        Family::Publish
    };
    let act = act(handle, seq, family);
    let node = NodeId::Mint(act.clone()).to_string();
    let mut tx = pool.begin().await.expect("tx");
    match parent {
        None => content::insert_post(
            &mut tx,
            id,
            author,
            &node,
            "a=0;o=0",
            None,
            authored_at(secs),
            Some("still settling"),
            None,
            "pending",
            None,
        )
        .await
        .expect("pending post"),
        Some(parent) => content::insert_comment(
            &mut tx,
            id,
            parent,
            "post",
            author,
            &node,
            "a=0;o=0",
            None,
            authored_at(secs),
            "pending",
            None,
        )
        .await
        .expect("pending comment"),
    };
    tx.commit().await.expect("commit");
    staged_row(pool, author, &act, family, None, &node, p, Some(id), secs).await;
    id
}

/// A pending Tag by `handle` on `node` toward `topic` at `relevance`.
async fn pending_tag(
    pool: &PgPool,
    handle: &str,
    seq: u64,
    node: Uuid,
    topic: &str,
    relevance: f64,
) {
    let author = actor_id(pool, handle).await;
    let node_id: String = sqlx::query_scalar(
        "SELECT l1_node_id FROM posts WHERE id = $1
         UNION ALL SELECT l1_node_id FROM comments WHERE id = $1",
    )
    .bind(node)
    .fetch_one(pool)
    .await
    .expect("the tagged node");
    staged_row(
        pool,
        author,
        &act(handle, seq, Family::Tag),
        Family::Tag,
        Some(&node_id),
        &format!("name:{topic}"),
        (relevance, 1.0),
        None,
        10 + seq as i64,
    )
    .await;
}

async fn registered_topic(pool: &PgPool, name: &str) -> Uuid {
    let mut conn = pool.acquire().await.expect("conn");
    hashtag::upsert(&mut conn, name).await.expect("topic");
    common::hashtag_uuid(name)
}

/// A member with a session: (actor id, access token).
async fn reader(rig: &WireRig, handle: &str) -> (Uuid, String) {
    let email = format!("{handle}@example.test");
    let (id, _) = rig.seed_member(handle, &email).await;
    (id, rig.log_in(&email).await)
}

/// Captures what the code under test logs, on this thread, while the
/// guard lives.
#[derive(Clone, Default)]
struct Logs(Arc<Mutex<Vec<u8>>>);

impl std::io::Write for Logs {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        self.0.lock().expect("logs").extend_from_slice(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl Logs {
    fn capture() -> (tracing::subscriber::DefaultGuard, Self) {
        let logs = Self::default();
        let sink = logs.clone();
        let subscriber = tracing_subscriber::fmt()
            .with_ansi(false)
            .with_writer(move || sink.clone())
            .finish();
        (tracing::subscriber::set_default(subscriber), logs)
    }

    fn text(&self) -> String {
        String::from_utf8_lossy(&self.0.lock().expect("logs")).into_owned()
    }
}

/// The field names of one schema type, by introspection; None when the
/// schema has no such type.
async fn fields_of(rig: &WireRig, type_name: &str) -> Option<Vec<String>> {
    let data = rig
        .gql(
            None,
            "query($name: String!) { __type(name: $name) { fields { name } } }",
            json!({ "name": type_name }),
        )
        .await;
    data["__type"].as_object().map(|t| {
        t["fields"]
            .as_array()
            .expect("fields")
            .iter()
            .map(|f| f["name"].as_str().expect("name").to_string())
            .collect()
    })
}

/// The pod's order is the answer's order: scores out of any sorted order
/// come back exactly as the pod emitted them, because the relay never
/// sorts.
///
/// The relay returns the pod's entries in the pod's own order.
/// ´claim:relay:the-pods-order-passes-through´
#[sqlx::test(migrations = "../../migrations")]
async fn the_relay_returns_the_pods_order(pool: PgPool) {
    let (t1, t2, t3) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
    let (rig, _pod) = pod_rig(
        pool,
        Mode::Answer(ranking(
            &[
                (t1, "POST", 0.2, None, 2),
                (t2, "POST", 0.9, None, 0),
                (t3, "POST", 0.5, None, 1),
            ],
            &[],
        )),
    )
    .await;
    let f = fixture(&rig.pool).await;
    let answer = rank(&rig, None, json!({ "viewer": f.viewer })).await;
    assert_eq!(ids_of(&answer["entries"]), vec![t1, t2, t3]);
    let scores: Vec<f64> = answer["entries"]
        .as_array()
        .expect("entries")
        .iter()
        .map(|e| e["score"].as_f64().expect("score"))
        .collect();
    assert_eq!(scores, vec![0.2, 0.9, 0.5]);
}

/// Strictly equal scores are the tie-break cascade's, which the pod
/// applied (feed-ranking.md §7); the relay keeps the pod's order of them
/// even where the ids sort the other way.
///
/// (´claim:relay:the-pods-order-passes-through´)
#[sqlx::test(migrations = "../../migrations")]
async fn the_relay_never_resorts_equal_scores(pool: PgPool) {
    let mut ids: Vec<Uuid> = (0..4).map(|_| Uuid::new_v4()).collect();
    ids.sort();
    ids.reverse();
    let entries: Vec<(Uuid, &str, f64, Option<&str>, i64)> = ids
        .iter()
        .enumerate()
        .map(|(i, id)| (*id, "POST", 0.5, None, i as i64))
        .collect();
    let (rig, _pod) = pod_rig(pool, Mode::Answer(ranking(&entries, &[]))).await;
    let f = fixture(&rig.pool).await;
    let answer = rank(&rig, None, json!({ "viewer": f.viewer })).await;
    assert_eq!(ids_of(&answer["entries"]), ids);
}

/// Seen content ranks too (PR-47/PR-49): the reader's seen record lives on
/// the device, and the feed path reads none of it, so a target the reader
/// has seen is still in the answer.
///
/// A target the reader has already seen stays in the ranked answer.
/// ´claim:relay:seen-content-stays-in-the-answer´
#[sqlx::test(migrations = "../../migrations")]
async fn a_seen_target_stays_in_the_ranking(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Hold).await;
    let f = fixture(&rig.pool).await;
    let (me, token) = reader(&rig, "reader").await;
    let seen = rig
        .gql(
            Some(&token),
            "mutation($nodes: [UUID!]!) { markSeen(input: { nodes: $nodes }) { ok } }",
            json!({ "nodes": [f.post] }),
        )
        .await;
    assert_eq!(seen["markSeen"]["ok"], true);
    pod.set(Mode::Answer(ranking(
        &[(f.post, "POST", 0.4, None, 0)],
        &[],
    )));
    let answer = rank(&rig, Some(&token), json!({ "viewer": me })).await;
    assert_eq!(ids_of(&answer["entries"]), vec![f.post]);
}

/// No seen-list rides the in-house request (X-11; OC-8 omits the field
/// from the pod's schema): the device cuts what it has seen.
///
/// The relay's request to the pod carries no seen-list.
/// ´claim:relay:no-seen-list-reaches-the-pod´
#[sqlx::test(migrations = "../../migrations")]
async fn the_pod_request_carries_no_seen_list(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    let f = fixture(&rig.pool).await;
    let (me, token) = reader(&rig, "reader").await;
    rig.gql(
        Some(&token),
        "mutation($nodes: [UUID!]!) { markSeen(input: { nodes: $nodes }) { ok } }",
        json!({ "nodes": [f.post] }),
    )
    .await;
    rank(&rig, Some(&token), json!({ "viewer": me })).await;
    let params = &pod.last_variables()["params"];
    assert!(params.is_object(), "{params}");
    assert!(params.get("seenList").is_none(), "{params}");
    let sent = pod.requests().last().expect("a request").to_string();
    assert!(
        !sent.contains(&f.post.to_string()),
        "the seen id never rides: {sent}"
    );
}

/// The write path is unchanged: `markSeen` still records what History
/// reads, whatever the feed path no longer reads.
///
/// What markSeen records still reads back through History.
/// ´claim:relay:history-still-reads-what-mark-seen-wrote´
#[sqlx::test(migrations = "../../migrations")]
async fn mark_seen_still_feeds_history_after_the_feed_stops_reading_it(pool: PgPool) {
    let (rig, _pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    let f = fixture(&rig.pool).await;
    let (me, token) = reader(&rig, "reader").await;
    rig.gql(
        Some(&token),
        "mutation($nodes: [UUID!]!) { markSeen(input: { nodes: $nodes }) { ok } }",
        json!({ "nodes": [f.post] }),
    )
    .await;
    rank(&rig, Some(&token), json!({ "viewer": me })).await;
    let history = rig
        .gql(
            Some(&token),
            "{ me { viewHistory(first: 10) { edges { node { ... on Post { id } } } } } }",
            json!({}),
        )
        .await;
    assert_eq!(
        history["me"]["viewHistory"]["edges"][0]["node"]["id"],
        json!(f.post)
    );
}

/// The slice supply is generic (§3.6): one slice per viewer and epoch,
/// never shaped by a filter, so `feedSlice` takes exactly its four
/// arguments.
///
/// The slice supply takes no filter argument.
/// ´claim:slice:the-supply-takes-no-filter´
#[sqlx::test(migrations = "../../migrations")]
async fn the_slice_supply_takes_no_filter_argument(pool: PgPool) {
    let rig = rig(pool);
    let data = rig
        .gql(
            None,
            "{ __schema { queryType { fields { name args { name } } } } }",
            json!({}),
        )
        .await;
    let slice = data["__schema"]["queryType"]["fields"]
        .as_array()
        .expect("fields")
        .iter()
        .find(|f| f["name"] == "feedSlice")
        .expect("feedSlice is a root")
        .clone();
    let args: Vec<&str> = slice["args"]
        .as_array()
        .expect("args")
        .iter()
        .map(|a| a["name"].as_str().expect("name"))
        .collect();
    assert_eq!(args, vec!["viewer", "dustFloor", "gamma", "asOfEpoch"]);
}

/// The P-7 hook: every first-page read of a (viewer, epoch) slice is
/// counted and traced, so the would-be cache hit rate is measured before
/// any cache is built. A later page of the same read is not a new read; a
/// read pinned at another epoch is another key.
///
/// The slice supply counts first-page reads per viewer and epoch, logging each repeat.
/// ´claim:slice:the-supply-counts-reads-per-key´
#[sqlx::test(migrations = "../../migrations")]
async fn the_slice_supply_counts_reads_per_viewer_and_epoch(pool: PgPool) {
    let rig = rig(pool);
    let f = fixture(&rig.pool).await;
    let cursor = mirror::last_ingested_epoch(&rig.pool)
        .await
        .expect("cursor");
    let (_guard, logs) = Logs::capture();
    let first = slice(&rig, json!({ "viewer": f.viewer, "first": 2 })).await;
    assert_eq!(rig.slice_reads.reads(f.viewer, cursor), 1);
    let after = first["nodes"]["pageInfo"]["endCursor"].clone();
    slice(
        &rig,
        json!({ "viewer": f.viewer, "first": 2, "after": after }),
    )
    .await;
    assert_eq!(rig.slice_reads.reads(f.viewer, cursor), 1, "a later page");
    slice(&rig, json!({ "viewer": f.viewer, "first": 2 })).await;
    assert_eq!(rig.slice_reads.reads(f.viewer, cursor), 2);
    slice(
        &rig,
        json!({ "viewer": f.viewer, "asOf": cursor - 1, "first": 2 }),
    )
    .await;
    assert_eq!(rig.slice_reads.reads(f.viewer, cursor - 1), 1);
    let text = logs.text();
    assert!(text.contains("slice supply: first-page read"), "{text}");
    assert!(text.contains("repeat=true"), "{text}");
}

/// The seeded carrier with no landed Charter has no epoch to report: an
/// operational fault, refused loudly, never a row with a made-up epoch.
///
/// networkParameters on a carrier seeded before its Charter landed is INTERNAL and serves no row.
/// ´claim:params:a-half-bootstrapped-carrier-is-internal´
#[sqlx::test(migrations = "../../migrations")]
async fn network_parameters_before_the_charter_lands_is_internal(pool: PgPool) {
    let rig = rig(pool);
    let mut conn = rig.pool.acquire().await.expect("conn");
    genesis::seed_parameter(&mut conn, "gamma", &json!(1.0))
        .await
        .expect("seed");
    genesis::seed_parameter(&mut conn, "dust_floor", &json!(0.0))
        .await
        .expect("seed");
    drop(conn);
    let (_guard, logs) = Logs::capture();
    let response = rig.gql_raw(None, PARAMETERS, json!({ "keys": null })).await;
    assert_eq!(codes(&response), vec!["INTERNAL"]);
    assert!(response["data"].is_null(), "no row is served: {response}");
    assert!(
        logs.text()
            .contains("the parameter carrier is seeded but the Charter has not landed"),
        "{}",
        logs.text()
    );
}

/// Map, never compose (§4.2 step 6): both permutations — each entry's
/// NEWEST index and each settling row's two woven positions — arrive
/// exactly as the pod emitted them.
///
/// OS-17 (veto window open): the fixture's NEWEST places put the settling
/// rows ahead of every landed row, newest authored first — the ruled
/// reading the pod builds to (W-3). The relay passes whatever the pod
/// emits, so a veto changes the pod's emission and this test's fixture,
/// never the relay.
///
/// The relay passes the NEWEST permutation and both woven position sets through unchanged.
/// ´claim:relay:both-permutations-pass-through´
#[sqlx::test(migrations = "../../migrations")]
async fn the_relay_passes_both_permutations_through_unchanged(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Hold).await;
    let f = fixture(&rig.pool).await;
    let older = settling_content(&rig.pool, "a", 20, None, (0.5, 0.5), 1).await;
    let newer = settling_content(&rig.pool, "a", 21, None, (0.5, 0.5), 2).await;
    let (t1, t2, t3) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
    pod.set(Mode::Answer(ranking(
        &[
            (t1, "POST", 0.9, None, 2),
            (t2, "COMMENT", 0.7, None, 0),
            (t3, "USER", 0.1, None, 1),
        ],
        &[(older, None, 1, 1), (newer, None, 4, 0)],
    )));
    let answer = rank(&rig, None, json!({ "viewer": f.viewer })).await;
    assert_eq!(
        answer["entries"],
        json!([
            { "targetId": t1, "kind": "POST", "score": 0.9, "mark": null, "newestIndex": 2 },
            { "targetId": t2, "kind": "COMMENT", "score": 0.7, "mark": null, "newestIndex": 0 },
            { "targetId": t3, "kind": "USER", "score": 0.1, "mark": null, "newestIndex": 1 },
        ])
    );
    assert_eq!(
        answer["settling"],
        json!([
            { "targetId": older, "kind": "POST", "mark": null, "rankedPosition": 1, "newestPosition": 1 },
            { "targetId": newer, "kind": "POST", "mark": null, "rankedPosition": 4, "newestPosition": 0 },
        ])
    );
}

/// A place names its candidate by the opaque `ref` the relay sent; the
/// relay maps it back to the target and the kind its own staged read
/// found, a comment here.
///
/// A settling place maps to its candidate's target and staged kind.
/// ´claim:relay:a-place-maps-to-its-candidate´
#[sqlx::test(migrations = "../../migrations")]
async fn the_relay_maps_a_settling_ref_to_its_target_and_staged_kind(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Hold).await;
    let f = fixture(&rig.pool).await;
    let comment = settling_content(&rig.pool, "a", 20, Some(f.post), (0.3, 0.2), 1).await;
    pod.set(Mode::Answer(ranking(&[], &[(comment, None, 0, 0)])));
    let answer = rank(
        &rig,
        None,
        json!({ "viewer": f.viewer, "filter": { "kinds": ["COMMENT"] } }),
    )
    .await;
    assert_eq!(
        answer["settling"],
        json!([{ "targetId": comment, "kind": "COMMENT", "mark": null,
                 "rankedPosition": 0, "newestPosition": 0 }])
    );
}

/// `tieBreakers` leaves the public answer (§4.13): the public entry is
/// exactly its five fields, no `TieBreakers` type exists, and a document
/// asking for one is refused at validation.
///
/// The public answer carries no tie-breakers.
/// ´claim:relay:no-tie-breakers-on-the-wire´
#[sqlx::test(migrations = "../../migrations")]
async fn the_public_answer_carries_no_tie_breakers(pool: PgPool) {
    let (rig, _pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    assert_eq!(
        fields_of(&rig, "FeedEntry").await.expect("FeedEntry"),
        vec!["targetId", "kind", "score", "mark", "newestIndex"]
    );
    assert_eq!(fields_of(&rig, "TieBreakers").await, None);
    let refused = rig
        .gql_raw(
            None,
            "{ feedRanking(viewer: \"00000000-0000-0000-0000-000000000000\") {
                 entries { tieBreakers { netStance } } } }",
            json!({}),
        )
        .await;
    assert!(refused["errors"].is_array(), "{refused}");
    assert!(refused["data"].is_null(), "{refused}");
}

/// A settling row carries no score by construction (FeedSheet.md:49): the
/// type has no such field.
///
/// A settling entry has no score field.
/// ´claim:relay:a-settling-entry-has-no-score´
#[sqlx::test(migrations = "../../migrations")]
async fn a_settling_entry_carries_no_score(pool: PgPool) {
    let (rig, _pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    assert_eq!(
        fields_of(&rig, "SettlingEntry")
            .await
            .expect("SettlingEntry"),
        vec![
            "targetId",
            "kind",
            "mark",
            "rankedPosition",
            "newestPosition"
        ]
    );
}

/// The relay checks index sets and compares nothing: a NEWEST index that
/// is no permutation, a position duplicated, out of range or colliding
/// within one order, a place for something never sent, a candidate placed
/// twice, or a ranking at another epoch than the pin — each would hand the
/// device an undefined composition, so each is refused as INTERNAL and
/// logged.
///
/// A malformed pod answer surfaces as INTERNAL and is logged.
/// ´claim:relay:a-malformed-answer-is-internal´
#[sqlx::test(migrations = "../../migrations")]
async fn a_malformed_pod_permutation_surfaces_as_internal_and_is_logged(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Hold).await;
    let f = fixture(&rig.pool).await;
    let s1 = settling_content(&rig.pool, "a", 20, None, (0.5, 0.5), 1).await;
    let s2 = settling_content(&rig.pool, "a", 21, None, (0.5, 0.5), 2).await;
    let (t1, t2) = (Uuid::new_v4(), Uuid::new_v4());
    let cursor = mirror::last_ingested_epoch(&rig.pool)
        .await
        .expect("cursor");
    let malformed = [
        ranking(
            &[(t1, "POST", 0.9, None, 0), (t2, "POST", 0.5, None, 0)],
            &[],
        ),
        ranking(
            &[(t1, "POST", 0.9, None, 0), (t2, "POST", 0.5, None, 2)],
            &[],
        ),
        ranking(
            &[(t1, "POST", 0.9, None, 0)],
            &[(s1, None, 0, 0), (s2, None, 0, 1)],
        ),
        ranking(
            &[(t1, "POST", 0.9, None, 0)],
            &[(s1, None, 0, 1), (s2, None, 2, 1)],
        ),
        ranking(&[(t1, "POST", 0.9, None, 0)], &[(s1, None, 3, 0)]),
        ranking(&[], &[(Uuid::new_v4(), None, 0, 0)]),
        ranking(&[], &[(s1, None, 0, 0), (s1, None, 1, 1)]),
        ranking(&[(t1, "NOT_A_KIND", 0.9, None, 0)], &[]),
        {
            let mut wrong_epoch = ranking(&[], &[]);
            wrong_epoch["asOfEpoch"] = json!(cursor - 1);
            wrong_epoch
        },
    ];
    for answer in malformed {
        pod.set(Mode::Answer(answer.clone()));
        let (_guard, logs) = Logs::capture();
        let response = rank_raw(&rig, None, json!({ "viewer": f.viewer })).await;
        assert_eq!(codes(&response), vec!["INTERNAL"], "for {answer}");
        assert!(response["data"]["feedRanking"].is_null(), "for {answer}");
        assert!(
            logs.text().contains("pod answer malformed"),
            "for {answer}: {}",
            logs.text()
        );
    }
}

/// Marks ride for every reader as the vantage's: with the session's own
/// actor as the viewer, the pod's marks reach the reader on landed and
/// settling rows alike.
///
/// The pod's people marks ride as the vantage's, for every reader.
/// ´claim:relay:marks-ride-for-every-reader-as-the-vantages´
#[sqlx::test(migrations = "../../migrations")]
async fn marks_ride_for_every_reader_as_the_vantages(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Hold).await;
    fixture(&rig.pool).await;
    let (me, token) = reader(&rig, "reader").await;
    let settling = settling_content(&rig.pool, "a", 20, None, (0.5, 0.5), 1).await;
    let (t1, t2, t3, t4) = (
        Uuid::new_v4(),
        Uuid::new_v4(),
        Uuid::new_v4(),
        Uuid::new_v4(),
    );
    pod.set(Mode::Answer(ranking(
        &[
            (t1, "POST", 0.9, Some("FOR"), 0),
            (t2, "USER", 0.8, Some("AGAINST"), 1),
            (t3, "COMMENT", 0.7, Some("SIGNLESS"), 2),
            (t4, "HASHTAG", 0.6, None, 3),
        ],
        &[(settling, Some("AGAINST"), 0, 0)],
    )));
    let answer = rank(&rig, Some(&token), json!({ "viewer": me })).await;
    let marks: Vec<Value> = answer["entries"]
        .as_array()
        .expect("entries")
        .iter()
        .map(|e| e["mark"].clone())
        .collect();
    assert_eq!(
        marks,
        vec![
            json!("FOR"),
            json!("AGAINST"),
            json!("SIGNLESS"),
            Value::Null
        ]
    );
    assert_eq!(answer["settling"][0]["mark"], "AGAINST");
}

/// A borrowed view: the session's reader ranks another actor's view. The
/// marks are the vantage's, passed through as the pod emitted them — never
/// nulled; a null mark means only that the vantage holds no opinion of the
/// author.
///
/// A reader ranking someone else's view reads the vantage's marks.
/// ´claim:relay:a-borrowed-view-carries-the-vantages-marks´
#[sqlx::test(migrations = "../../migrations")]
async fn a_borrowing_readers_marks_are_the_vantages(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Hold).await;
    let f = fixture(&rig.pool).await;
    let (_me, token) = reader(&rig, "reader").await;
    let settling = settling_content(&rig.pool, "a", 20, None, (0.5, 0.5), 1).await;
    let t1 = Uuid::new_v4();
    pod.set(Mode::Answer(ranking(
        &[(t1, "POST", 0.9, Some("FOR"), 0)],
        &[(settling, Some("AGAINST"), 0, 0)],
    )));
    let answer = rank(&rig, Some(&token), json!({ "viewer": f.viewer })).await;
    assert_eq!(answer["entries"][0]["mark"], "FOR");
    assert_eq!(answer["settling"][0]["mark"], "AGAINST");
    assert_eq!(
        ids_of(&answer["entries"]),
        vec![t1],
        "the rows themselves ride"
    );
}

/// Without a session the ranking is still the vantage's: the pod's marks
/// pass through, and the ranking itself is served, never refused.
///
/// A session-less ranking is served with the vantage's marks.
/// ´claim:relay:a-session-less-ranking-carries-the-vantages-marks´
#[sqlx::test(migrations = "../../migrations")]
async fn a_session_less_rankings_marks_are_the_vantages(pool: PgPool) {
    let t1 = Uuid::new_v4();
    let (rig, _pod) = pod_rig(
        pool,
        Mode::Answer(ranking(&[(t1, "POST", 0.9, Some("FOR"), 0)], &[])),
    )
    .await;
    let f = fixture(&rig.pool).await;
    let answer = rank(&rig, None, json!({ "viewer": f.viewer })).await;
    assert_eq!(answer["entries"][0]["mark"], "FOR");
    assert_eq!(ids_of(&answer["entries"]), vec![t1]);
}

/// The relay owns the id mapping: a staged row's author is L1's bare
/// atom, and the relay forwards it in the slice's own person key, so the
/// pod joins it against `SliceNode.graphId` with no rule of its own.
///
/// A settling candidate's author rides as the person's slice node identifier.
/// ´claim:relay:the-candidate-author-is-the-slice-key´
#[sqlx::test(migrations = "../../migrations")]
async fn a_settling_candidates_author_rides_in_the_slices_prof_form(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    let f = fixture(&rig.pool).await;
    settling_content(&rig.pool, "a", 20, None, (0.5, 0.5), 1).await;
    rank(&rig, None, json!({ "viewer": f.viewer })).await;
    let author = sent_candidates(&pod)[0]["author"]
        .as_str()
        .expect("author")
        .to_string();
    assert_eq!(author, format!("prof:{}", atom("a")));
    assert!(
        node_ids(&full_slice(&rig, f.viewer).await).contains(&author),
        "{author} is the slice's own node"
    );
}

/// Equal settling keys (same author, same stance parameters) have nothing
/// but the provisional tie-break to order them (PR-66): the relay sends the
/// candidates newest `authoredAt` first, then by node id bytes. The fixture
/// pins both halves: the oldest candidate has the lowest id, so an id-only
/// order would lead with it, and three candidates share one instant, so
/// only the id bytes order them.
///
/// Equal settling keys break by newest authoring instant, then by id bytes.
/// ´claim:relay:equal-settling-keys-break-by-authored-at-then-id´
#[sqlx::test(migrations = "../../migrations")]
async fn equal_settling_keys_break_by_authored_at_then_id(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    let f = fixture(&rig.pool).await;
    let id = |byte: u8| Uuid::from_bytes([byte; 16]);
    let (oldest, high, low, mid) = (id(0x01), id(0xff), id(0x02), id(0x03));
    let same = (0.5, 0.5);
    settling_content_as(&rig.pool, oldest, "a", 20, None, same, 3).await;
    settling_content_as(&rig.pool, high, "a", 21, None, same, 9).await;
    settling_content_as(&rig.pool, low, "a", 22, None, same, 9).await;
    settling_content_as(&rig.pool, mid, "a", 23, None, same, 9).await;
    rank(&rig, None, json!({ "viewer": f.viewer })).await;
    let sent: Vec<Uuid> = sent_candidates(&pod)
        .iter()
        .map(|c| c["ref"].as_str().expect("ref").parse().expect("uuid"))
        .collect();
    assert_eq!(sent, vec![low, mid, high, oldest]);
}

/// The pod's parameters for the relay: kinds and the topic, the network
/// defaults for every calibration field, the friend reorder off (PR-18),
/// and each candidate with its own authorship edge as staged — author,
/// family, the authored parameters and the authoring instant.
///
/// Each candidate rides with its author, family, own parameters and authoring instant.
/// ´claim:relay:a-candidate-rides-with-its-own-edge´
#[sqlx::test(migrations = "../../migrations")]
async fn the_relay_sends_each_candidate_with_its_author_family_and_own_params(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    let f = fixture(&rig.pool).await;
    let post = settling_content(&rig.pool, "a", 20, None, (0.75, -0.25), 7).await;
    rank(&rig, None, json!({ "viewer": f.viewer })).await;
    let candidates = sent_candidates(&pod);
    assert_eq!(candidates.len(), 1);
    let c = &candidates[0];
    assert_eq!(c["ref"], json!(post));
    assert_eq!(c["author"], format!("prof:{}", atom("a")));
    assert_eq!(c["family"], "publish");
    assert_eq!(c["pDirected"], 0.75);
    assert_eq!(c["pInterest"], -0.25);
    let authored: chrono::DateTime<chrono::Utc> = c["authoredAt"]
        .as_str()
        .expect("authoredAt")
        .parse()
        .expect("an instant");
    assert_eq!(authored, authored_at(7));
}

/// The friend-fresh reorder is post-MVP (PR-18): the relay asks for it off.
///
/// The relay sends the friend reorder disabled.
/// ´claim:relay:friend-reorder-is-off´
#[sqlx::test(migrations = "../../migrations")]
async fn the_relay_sends_friend_reorder_disabled(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    let f = fixture(&rig.pool).await;
    rank(&rig, None, json!({ "viewer": f.viewer })).await;
    let params = &pod.last_variables()["params"];
    assert_eq!(params["friendAuthorReorder"]["enabled"], false);
    for default in ["gamma", "dustFloor", "recencyHalfLifeEpochs"] {
        assert!(
            params[default].is_null(),
            "{default} is the network's: {params}"
        );
    }
}

/// A candidate the pod leaves unplaced has no woven place (OS-10's
/// admission: the place is the admission), so it is absent from
/// `settling`.
///
/// A candidate the pod leaves unplaced is never woven.
/// ´claim:relay:an-unplaced-candidate-is-absent´
#[sqlx::test(migrations = "../../migrations")]
async fn a_candidate_the_pod_leaves_unkeyed_is_never_woven(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Hold).await;
    let f = fixture(&rig.pool).await;
    let placed = settling_content(&rig.pool, "a", 20, None, (0.5, 0.5), 1).await;
    let unplaced = settling_content(&rig.pool, "a", 21, None, (0.5, 0.5), 2).await;
    pod.set(Mode::Answer(ranking(&[], &[(placed, None, 0, 0)])));
    let answer = rank(&rig, None, json!({ "viewer": f.viewer })).await;
    assert_eq!(sent_refs(&pod), HashSet::from([placed, unplaced]));
    assert_eq!(ids_of(&answer["settling"]), vec![placed]);
}

/// Reach is the pod's to judge (OS-10; X-8′): the relay reads no fold, so
/// a settling post by an author the viewer has severed rides to the pod
/// like any other — and the pod, finding no live path, leaves it unwoven.
///
/// The severed author's settling post rides to the pod and is woven only by the pod's word.
/// ´claim:relay:reach-is-the-pods-to-judge´
#[sqlx::test(migrations = "../../migrations")]
async fn a_settling_post_by_a_severed_author_is_never_woven(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    let f = fixture(&rig.pool).await;
    let severed = settling_content(&rig.pool, "b", 20, None, (0.5, 0.5), 1).await;
    let answer = rank(&rig, None, json!({ "viewer": f.viewer })).await;
    assert!(
        sent_refs(&pod).contains(&severed),
        "the relay never pre-judges reach"
    );
    assert_eq!(answer["settling"], json!([]));
}

/// The pod places a reached author's settling post, and the relay carries
/// the place.
///
/// (´claim:relay:reach-is-the-pods-to-judge´)
#[sqlx::test(migrations = "../../migrations")]
async fn a_settling_post_by_a_live_reached_author_is_woven(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Hold).await;
    let f = fixture(&rig.pool).await;
    let reached = settling_content(&rig.pool, "a", 20, None, (0.5, 0.5), 1).await;
    pod.set(Mode::Answer(ranking(&[], &[(reached, None, 0, 0)])));
    let answer = rank(&rig, None, json!({ "viewer": f.viewer })).await;
    assert!(sent_refs(&pod).contains(&reached));
    assert_eq!(ids_of(&answer["settling"]), vec![reached]);
}

/// A write carried with an application is held and author-only: it is
/// never served to anyone else, so it is never a candidate.
///
/// A carried application write is never a settling candidate.
/// ´claim:relay:a-carried-write-is-never-a-candidate´
#[sqlx::test(migrations = "../../migrations")]
async fn a_carried_application_write_is_never_a_candidate(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    let f = fixture(&rig.pool).await;
    let carried = settling_content(&rig.pool, "a", 20, None, (0.5, 0.5), 1).await;
    sqlx::query("UPDATE staged_writes SET state = 'carried', carried = TRUE WHERE node_id = $1")
        .bind(carried)
        .execute(&rig.pool)
        .await
        .expect("carry");
    let kept = settling_content(&rig.pool, "a", 21, None, (0.5, 0.5), 2).await;
    rank(&rig, None, json!({ "viewer": f.viewer })).await;
    assert_eq!(sent_refs(&pod), HashSet::from([kept]));
}

/// The candidates narrow by what the ranker computes over and nothing
/// else: `kinds` (a comment is no candidate of a Posts feed), and under a
/// topic, the author's own current declaration of it (a third party's
/// pending tag, or the author's withdrawn one, admits nothing).
///
/// Settling candidates narrow by kinds and topic only.
/// ´claim:relay:candidates-narrow-by-kinds-and-topic´
#[sqlx::test(migrations = "../../migrations")]
async fn candidates_narrow_by_kinds_and_topic_only(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    let f = fixture(&rig.pool).await;
    let post = settling_content(&rig.pool, "a", 20, None, (0.5, 0.5), 1).await;
    let comment = settling_content(&rig.pool, "a", 21, Some(f.post), (0.5, 0.5), 2).await;
    let rank_with = |filter: Value| {
        let rig = &rig;
        let viewer = f.viewer;
        async move { rank(rig, None, json!({ "viewer": viewer, "filter": filter })).await }
    };
    rank_with(json!({ "kinds": ["POST"] })).await;
    assert_eq!(sent_refs(&pod), HashSet::from([post]));
    rank_with(json!({ "kinds": ["COMMENT"] })).await;
    assert_eq!(sent_refs(&pod), HashSet::from([comment]));
    rank_with(json!({ "kinds": ["POST", "COMMENT"] })).await;
    assert_eq!(sent_refs(&pod), HashSet::from([post, comment]));
    rank_with(json!({ "kinds": ["USER", "HASHTAG"] })).await;
    assert_eq!(sent_refs(&pod), HashSet::new());

    let salt = registered_topic(&rig.pool, "salt").await;
    let own = settling_content(&rig.pool, "a", 22, None, (0.5, 0.5), 3).await;
    pending_tag(&rig.pool, "a", 30, own, "salt", 1.0).await;
    let others = settling_content(&rig.pool, "a", 23, None, (0.5, 0.5), 4).await;
    pending_tag(&rig.pool, "b", 30, others, "salt", 1.0).await;
    let withdrawn = settling_content(&rig.pool, "a", 24, None, (0.5, 0.5), 5).await;
    pending_tag(&rig.pool, "a", 31, withdrawn, "salt", 1.0).await;
    pending_tag(&rig.pool, "a", 32, withdrawn, "salt", 0.0).await;
    rank_with(json!({ "topic": salt })).await;
    assert_eq!(sent_refs(&pod), HashSet::from([own]));
    assert_eq!(pod.last_variables()["params"]["topic"], json!(salt));
}

/// Seen and people are the device's cuts (PR-49): a candidate the reader
/// has seen, by an author the reader holds no opinion of, still rides.
///
/// Settling candidates are never narrowed by seen or people.
/// ´claim:relay:candidates-ignore-seen-and-people´
#[sqlx::test(migrations = "../../migrations")]
async fn candidates_are_never_narrowed_by_seen_or_people(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    fixture(&rig.pool).await;
    let (me, token) = reader(&rig, "reader").await;
    let by_a_stranger = settling_content(&rig.pool, "x", 20, None, (0.5, 0.5), 1).await;
    sqlx::query(
        "INSERT INTO user_view_log (user_id, content_id, kind, first_seen_at)
         VALUES ($1, $2, 'post', NOW())",
    )
    .bind(me)
    .bind(by_a_stranger)
    .execute(&rig.pool)
    .await
    .expect("seen");
    rank(&rig, Some(&token), json!({ "viewer": me })).await;
    assert_eq!(sent_refs(&pod), HashSet::from([by_a_stranger]));
}

/// The candidates ride on every call — there is no Still-settling
/// argument; a reader with it off cuts them on the device — each with its
/// authoring instant, which orders it in its gap and under Newest.
///
/// Candidates always ride, each with its authoring instant.
/// ´claim:relay:candidates-always-ride´
#[sqlx::test(migrations = "../../migrations")]
async fn candidates_always_ride_and_carry_their_authoring_instant(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    let f = fixture(&rig.pool).await;
    rank(&rig, None, json!({ "viewer": f.viewer })).await;
    assert_eq!(pod.last_variables()["params"]["settling"], json!([]));
    settling_content(&rig.pool, "a", 20, None, (0.5, 0.5), 9).await;
    rank(&rig, None, json!({ "viewer": f.viewer, "filter": {} })).await;
    let c = &sent_candidates(&pod)[0];
    let authored: chrono::DateTime<chrono::Utc> = c["authoredAt"]
        .as_str()
        .expect("instant")
        .parse()
        .expect("instant");
    assert_eq!(authored, authored_at(9));
}

/// Both woven position sets index their own list: `entries` and `settling`
/// together, each order's positions distinct and inside it.
///
/// OS-17 (veto window open): the NEWEST positions follow the ruled
/// reading, settling ahead of landed.
///
/// Each woven position set indexes its woven list exactly once.
/// ´claim:relay:each-position-set-indexes-its-list´
#[sqlx::test(migrations = "../../migrations")]
async fn both_settling_position_sets_index_their_woven_lists(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Hold).await;
    let f = fixture(&rig.pool).await;
    let s1 = settling_content(&rig.pool, "a", 20, None, (0.5, 0.5), 1).await;
    let s2 = settling_content(&rig.pool, "a", 21, None, (0.5, 0.5), 2).await;
    let (t1, t2) = (Uuid::new_v4(), Uuid::new_v4());
    pod.set(Mode::Answer(ranking(
        &[(t1, "POST", 0.9, None, 1), (t2, "POST", 0.4, None, 0)],
        &[(s1, None, 1, 1), (s2, None, 3, 0)],
    )));
    let answer = rank(&rig, None, json!({ "viewer": f.viewer })).await;
    let woven = answer["entries"].as_array().expect("entries").len()
        + answer["settling"].as_array().expect("settling").len();
    for order in ["rankedPosition", "newestPosition"] {
        let positions: Vec<usize> = answer["settling"]
            .as_array()
            .expect("settling")
            .iter()
            .map(|s| s[order].as_u64().expect("position") as usize)
            .collect();
        let distinct: HashSet<usize> = positions.iter().copied().collect();
        assert_eq!(distinct.len(), positions.len(), "{order}");
        assert!(positions.iter().all(|p| *p < woven), "{order}");
    }
    let newest: HashSet<i64> = answer["entries"]
        .as_array()
        .expect("entries")
        .iter()
        .map(|e| e["newestIndex"].as_i64().expect("index"))
        .collect();
    assert_eq!(newest, HashSet::from([0, 1]));
}

/// Settling content never enters `entries`: it is never in the slice and
/// never scored, and its place comes back on `settling` alone.
///
/// Settling content is never among the ranked entries.
/// ´claim:relay:settling-is-never-an-entry´
#[sqlx::test(migrations = "../../migrations")]
async fn settling_is_never_in_the_ranked_entries(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Hold).await;
    let f = fixture(&rig.pool).await;
    let pending = settling_content(&rig.pool, "a", 20, None, (0.5, 0.5), 1).await;
    pod.set(Mode::Answer(ranking(
        &[(f.post, "POST", 0.5, None, 0)],
        &[(pending, None, 0, 0)],
    )));
    let answer = rank(&rig, None, json!({ "viewer": f.viewer })).await;
    assert_eq!(ids_of(&answer["entries"]), vec![f.post]);
    assert_eq!(ids_of(&answer["settling"]), vec![pending]);
    let node_set = node_ids(&full_slice(&rig, f.viewer).await);
    let pending_node: String = sqlx::query_scalar("SELECT l1_node_id FROM posts WHERE id = $1")
        .bind(pending)
        .fetch_one(&rig.pool)
        .await
        .expect("node");
    assert!(
        !node_set.contains(&pending_node),
        "settling rides beside the slice"
    );
}

/// A target whose record has landed is no longer settling (W-4), even
/// while its content row has not caught up. Landed by the pin, it ranks
/// among the entries, so it never repeats beside them; landed after the
/// pin, it is in neither list for that call and arrives with the next.
///
/// A target whose record has landed is never a settling candidate.
/// ´claim:relay:a-landed-id-never-repeats-as-settling´
#[sqlx::test(migrations = "../../migrations")]
async fn a_landed_id_never_repeats_in_settling(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    let f = fixture(&rig.pool).await;
    let lagging = settling_content(&rig.pool, "a", 20, None, (0.5, 0.5), 1).await;
    let still = settling_content(&rig.pool, "a", 21, None, (0.5, 0.5), 2).await;
    rank(&rig, None, json!({ "viewer": f.viewer })).await;
    assert_eq!(sent_refs(&pod), HashSet::from([lagging, still]));
    let landed_at = land(
        &rig.pool,
        vec![binary(
            "a",
            20,
            Family::Publish,
            minted("a", 20, Family::Publish),
        )],
    )
    .await;
    for pin in [landed_at, landed_at - 1] {
        rank(&rig, None, json!({ "viewer": f.viewer, "asOf": pin })).await;
        assert_eq!(sent_refs(&pod), HashSet::from([still]), "pinned at {pin}");
    }
}

/// A repinned call reproduces `entries` and reads `settling` live (W-5):
/// the pin rides to the pod again, while the candidates are re-read on
/// every call, so content signed since the first call rides the second.
///
/// A ranking repinned at its epoch reproduces its entries and re-reads settling live.
/// ´claim:relay:a-repin-reads-settling-live´
#[sqlx::test(migrations = "../../migrations")]
async fn a_repinned_ranking_reproduces_entries_and_reads_settling_live(pool: PgPool) {
    let t1 = Uuid::new_v4();
    let (rig, pod) = pod_rig(
        pool,
        Mode::Answer(ranking(&[(t1, "POST", 0.5, None, 0)], &[])),
    )
    .await;
    let f = fixture(&rig.pool).await;
    let first = rank(&rig, None, json!({ "viewer": f.viewer })).await;
    let pin = first["asOfEpoch"].as_i64().expect("epoch");
    assert_eq!(sent_refs(&pod), HashSet::new());
    let signed_since = settling_content(&rig.pool, "a", 20, None, (0.5, 0.5), 1).await;
    land(&rig.pool, vec![binary("x", 30, Family::Opinion, prof("a"))]).await;
    let again = rank(&rig, None, json!({ "viewer": f.viewer, "asOf": pin })).await;
    assert_eq!(again["entries"], first["entries"]);
    assert_eq!(pod.last_variables()["asOfEpoch"], pin);
    assert_eq!(sent_refs(&pod), HashSet::from([signed_since]));
}

/// Null kinds rank Posts only (feed-ranking.md §9.3; miner-api.md:80).
///
/// A ranking with no kinds named ranks Posts only.
/// ´claim:relay:null-kinds-rank-posts´
#[sqlx::test(migrations = "../../migrations")]
async fn null_kinds_rank_posts_only(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    let f = fixture(&rig.pool).await;
    rank(&rig, None, json!({ "viewer": f.viewer })).await;
    assert_eq!(pod.last_variables()["params"]["kinds"], json!(["POST"]));
    rank(
        &rig,
        None,
        json!({ "viewer": f.viewer, "filter": { "kinds": null } }),
    )
    .await;
    assert_eq!(pod.last_variables()["params"]["kinds"], json!(["POST"]));
}

/// No kind admits a candidate, so the server answers empty at the pin
/// without asking the pod — the client never asks, but the server stays
/// total.
///
/// An empty kind list ranks nothing and never calls the ranker.
/// ´claim:relay:no-kinds-never-calls-the-ranker´
#[sqlx::test(migrations = "../../migrations")]
async fn an_empty_kind_list_ranks_nothing_and_never_calls_the_ranker(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    let f = fixture(&rig.pool).await;
    settling_content(&rig.pool, "a", 20, None, (0.5, 0.5), 1).await;
    let cursor = mirror::last_ingested_epoch(&rig.pool)
        .await
        .expect("cursor");
    let answer = rank(
        &rig,
        None,
        json!({ "viewer": f.viewer, "filter": { "kinds": [] } }),
    )
    .await;
    assert_eq!(
        answer,
        json!({ "asOfEpoch": cursor, "entries": [], "settling": [] })
    );
    assert!(pod.requests().is_empty());
}

/// The topic narrows the pod's candidates (§5.2), so it rides the pod's
/// parameters as the Hashtag id the client sent — known to the registry
/// or not.
///
/// The topic rides the pod's parameters as sent.
/// ´claim:relay:the-topic-rides´
#[sqlx::test(migrations = "../../migrations")]
async fn the_topic_rides_the_rank_params(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    let f = fixture(&rig.pool).await;
    let salt = registered_topic(&rig.pool, "salt").await;
    rank(
        &rig,
        None,
        json!({ "viewer": f.viewer, "filter": { "topic": salt } }),
    )
    .await;
    assert_eq!(pod.last_variables()["params"]["topic"], json!(salt));
    let unknown = Uuid::new_v4();
    let answer = rank(
        &rig,
        None,
        json!({ "viewer": f.viewer, "filter": { "topic": unknown } }),
    )
    .await;
    assert_eq!(pod.last_variables()["params"]["topic"], json!(unknown));
    assert_eq!(answer["settling"], json!([]));
}

/// An unpinned call ranks at the mirror cursor, sends that epoch to the
/// pod explicitly — so every slice page the pod pulls is one snapshot —
/// and reports it.
///
/// A ranking reports the epoch it was ranked at, sent to the pod explicitly.
/// ´claim:relay:the-ranking-reports-its-epoch´
#[sqlx::test(migrations = "../../migrations")]
async fn the_ranking_reports_its_epoch(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    let f = fixture(&rig.pool).await;
    let cursor = mirror::last_ingested_epoch(&rig.pool)
        .await
        .expect("cursor");
    let answer = rank(&rig, None, json!({ "viewer": f.viewer })).await;
    assert_eq!(answer["asOfEpoch"], cursor);
    assert_eq!(pod.last_variables()["asOfEpoch"], cursor);
    assert_eq!(pod.last_variables()["viewer"], json!(f.viewer));
}

/// A call pinned at a reported epoch asks the pod for that epoch again
/// and passes the same answer through, after the mirror has moved on.
///
/// A ranking repinned at its epoch is identical.
/// ´claim:relay:a-repinned-ranking-is-identical´
#[sqlx::test(migrations = "../../migrations")]
async fn a_ranking_repinned_at_its_epoch_is_identical(pool: PgPool) {
    let (t1, t2) = (Uuid::new_v4(), Uuid::new_v4());
    let (rig, pod) = pod_rig(
        pool,
        Mode::Answer(ranking(
            &[(t1, "POST", 0.9, None, 1), (t2, "POST", 0.1, None, 0)],
            &[],
        )),
    )
    .await;
    let f = fixture(&rig.pool).await;
    let first = rank(&rig, None, json!({ "viewer": f.viewer })).await;
    land(&rig.pool, vec![binary("x", 30, Family::Opinion, prof("a"))]).await;
    let pin = first["asOfEpoch"].clone();
    let again = rank(&rig, None, json!({ "viewer": f.viewer, "asOf": pin })).await;
    assert_eq!(pod.last_variables()["asOfEpoch"], pin);
    assert_eq!(again, first);
}

/// The pin must name an ingested epoch.
///
/// A ranking pinned past the mirror cursor or below zero is BAD_INPUT, and the pod is never called.
/// ´claim:relay:a-pin-past-the-mirror-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn ranking_pinned_past_the_mirror_is_bad_input(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Answer(ranking(&[], &[]))).await;
    let f = fixture(&rig.pool).await;
    let cursor = mirror::last_ingested_epoch(&rig.pool)
        .await
        .expect("cursor");
    for pin in [cursor + 1, -1] {
        let response = rank_raw(&rig, None, json!({ "viewer": f.viewer, "asOf": pin })).await;
        assert_eq!(codes(&response), vec!["BAD_INPUT"], "for {pin}");
    }
    assert!(pod.requests().is_empty());
}

/// A viewer the pod finds no slice for reads null, and so does a mirror
/// with nothing ingested — there the relay never asks.
///
/// A ranking of an unrankable viewer reads null.
/// ´claim:relay:an-unrankable-viewer-reads-null´
#[sqlx::test(migrations = "../../migrations")]
async fn ranking_an_unknown_viewer_reads_null(pool: PgPool) {
    let (rig, pod) = pod_rig(pool, Mode::Fault("NOT_FOUND")).await;
    let empty = rank(&rig, None, json!({ "viewer": Uuid::new_v4() })).await;
    assert_eq!(empty, Value::Null);
    assert!(pod.requests().is_empty(), "an empty mirror ranks nothing");
    fixture(&rig.pool).await;
    let unknown = rank(&rig, None, json!({ "viewer": Uuid::new_v4() })).await;
    assert_eq!(unknown, Value::Null);
    assert_eq!(pod.requests().len(), 1);
}

/// The pod's NOT_FOUND (a null slice) is the relay's null, never an
/// error.
///
/// (´claim:relay:an-unrankable-viewer-reads-null´)
#[sqlx::test(migrations = "../../migrations")]
async fn a_pod_not_found_reads_null(pool: PgPool) {
    let (rig, _pod) = pod_rig(pool, Mode::Fault("NOT_FOUND")).await;
    let f = fixture(&rig.pool).await;
    let response = rank_raw(&rig, None, json!({ "viewer": f.viewer })).await;
    assert!(response["errors"].is_null(), "{response}");
    assert_eq!(response["data"]["feedRanking"], Value::Null);
}

/// The relay sends no calibration of its own, so the pod refusing its
/// request as bad input is a relay bug: INTERNAL, logged as one.
///
/// The pod's BAD_INPUT surfaces as INTERNAL and is logged as a relay bug.
/// ´claim:relay:a-pod-bad-input-is-internal´
#[sqlx::test(migrations = "../../migrations")]
async fn a_pod_bad_input_surfaces_as_internal_and_is_logged(pool: PgPool) {
    let (rig, _pod) = pod_rig(pool, Mode::Fault("BAD_INPUT")).await;
    let f = fixture(&rig.pool).await;
    let (_guard, logs) = Logs::capture();
    let response = rank_raw(&rig, None, json!({ "viewer": f.viewer })).await;
    assert_eq!(codes(&response), vec!["INTERNAL"]);
    assert!(logs.text().contains("a relay bug"), "{}", logs.text());
}

/// No silent fallback (§4.5): with the pod unreachable the answer is the
/// drawn fault, never a Newest listing standing in for the ranking.
///
/// A ranking with the ranker down is INTERNAL, never a silent Newest.
/// ´claim:relay:the-ranker-down-is-internal´
#[sqlx::test(migrations = "../../migrations")]
async fn ranking_with_the_ranker_down_is_internal_never_newest(pool: PgPool) {
    let closed = {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind");
        listener.local_addr().expect("addr")
    };
    let rig = WireRig::with_ranker(
        pool,
        RateLimitConfig::unlimited(),
        &RankerConfig {
            url: format!("http://{closed}/graphql"),
            ..RankerConfig::default()
        },
    );
    let f = fixture(&rig.pool).await;
    let (_guard, logs) = Logs::capture();
    let response = rank_raw(&rig, None, json!({ "viewer": f.viewer })).await;
    assert_eq!(codes(&response), vec!["INTERNAL"]);
    assert!(response["data"]["feedRanking"].is_null(), "{response}");
    assert!(logs.text().contains("unreachable"), "{}", logs.text());
}

/// A pod slower than `RANKER_TIMEOUT_MS` is a fault, not a wait.
///
/// A ranking past the timeout is INTERNAL.
/// ´claim:relay:past-the-timeout-is-internal´
#[sqlx::test(migrations = "../../migrations")]
async fn ranking_past_the_timeout_is_internal(pool: PgPool) {
    let (rig, _pod) = pod_rig_with(
        pool,
        Mode::Slow(Duration::from_secs(5), ranking(&[], &[])),
        |config| config.timeout = Duration::from_millis(200),
    )
    .await;
    let f = fixture(&rig.pool).await;
    let (_guard, logs) = Logs::capture();
    let response = rank_raw(&rig, None, json!({ "viewer": f.viewer })).await;
    assert_eq!(codes(&response), vec!["INTERNAL"]);
    assert!(
        logs.text().contains("did not answer within"),
        "{}",
        logs.text()
    );
}

/// Backpressure: with every slot held, a call that cannot get one within
/// the timeout is refused without reaching the pod. One slot; the first
/// call holds it at the pod until its own timeout, the second (queued once
/// the first is at the pod) takes it then, and the third — queued behind
/// both — runs out of time first.
///
/// A ranking over the in-flight cap is INTERNAL and never reaches the pod.
/// ´claim:relay:over-the-cap-is-internal´
#[sqlx::test(migrations = "../../migrations")]
async fn ranking_over_the_in_flight_cap_is_internal(pool: PgPool) {
    let (rig, pod) = pod_rig_with(pool, Mode::Hold, |config| {
        config.timeout = Duration::from_millis(400);
        config.max_in_flight = 1;
    })
    .await;
    let f = fixture(&rig.pool).await;
    let (_guard, logs) = Logs::capture();
    let variables = json!({ "viewer": f.viewer });
    let (first, (second, third)) = tokio::join!(rank_raw(&rig, None, variables.clone()), async {
        tokio::time::timeout(Duration::from_secs(5), async {
            while pod.requests().is_empty() {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .expect("the first call reaches the pod");
        tokio::time::sleep(Duration::from_millis(100)).await;
        tokio::join!(
            rank_raw(&rig, None, variables.clone()),
            rank_raw(&rig, None, variables.clone())
        )
    });
    for response in [&first, &second, &third] {
        assert_eq!(codes(response), vec!["INTERNAL"]);
    }
    assert_eq!(
        pod.requests().len(),
        2,
        "the third call never reached the pod"
    );
    let text = logs.text();
    assert!(text.contains("over the in-flight cap"), "{text}");
    assert!(text.contains("did not answer within"), "{text}");
}

/// T-POOL: the pod calls back into this api for the slice while the relay
/// waits on it, so the relay must hold no pooled connection across the
/// call. With a one-connection pool, a relay that held one would starve
/// the pod's slice read until the call timed out.
///
/// The relay completes with a one-connection pool while the pod reads the slice back.
/// ´claim:relay:no-connection-is-held-across-the-pod-call´
#[sqlx::test(migrations = "../../migrations")]
async fn the_relay_completes_with_a_one_connection_pool(pool: PgPool) {
    let one = sqlx::postgres::PgPoolOptions::new()
        .max_connections(1)
        .connect_with((*pool.connect_options()).clone())
        .await
        .expect("a one-connection pool");
    let f = fixture(&one).await;
    let (rig, pod) = pod_rig_with(one, Mode::Hold, |config| {
        config.timeout = Duration::from_secs(10);
    })
    .await;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind the api");
    let api_url = format!("http://{}/graphql", listener.local_addr().expect("addr"));
    let app = rig.app.clone();
    tokio::spawn(async move { axum::serve(listener, app).await.expect("the api serves") });
    pod.set(Mode::FetchSliceThen(
        api_url,
        ranking(&[(f.post, "POST", 0.5, None, 0)], &[]),
    ));
    let answer = rank(&rig, None, json!({ "viewer": f.viewer })).await;
    assert_eq!(ids_of(&answer["entries"]), vec![f.post]);
    assert_eq!(pod.requests().len(), 1);
}

/// One raw POST to `/graphql`: (status, headers, body bytes as sent).
async fn post_graphql(
    rig: &WireRig,
    body: Value,
    accept_gzip: bool,
    token: Option<&str>,
) -> (axum::http::HeaderMap, Vec<u8>) {
    use http_body_util::BodyExt;
    use tower::ServiceExt;
    let mut builder = axum::http::Request::builder()
        .method("POST")
        .uri("/graphql")
        .header("content-type", "application/json");
    if accept_gzip {
        builder = builder.header("accept-encoding", "gzip");
    }
    if let Some(token) = token {
        builder = builder.header("authorization", format!("Bearer {token}"));
    }
    let response = rig
        .app
        .clone()
        .oneshot(
            builder
                .body(axum::body::Body::from(body.to_string()))
                .expect("request"),
        )
        .await
        .expect("response");
    let headers = response.headers().clone();
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("body")
        .to_bytes()
        .to_vec();
    (headers, bytes)
}

fn gunzip(bytes: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    flate2::read::GzDecoder::new(bytes)
        .read_to_end(&mut out)
        .expect("valid gzip");
    out
}

/// A pod answer worth compressing: twenty entries, marks and indices.
fn a_page_of_entries() -> Value {
    let entries: Vec<(Uuid, &str, f64, Option<&str>, i64)> = (0..20)
        .map(|i| {
            (
                Uuid::new_v4(),
                "POST",
                1.0 / f64::from(i + 1),
                Some("FOR"),
                19 - i64::from(i),
            )
        })
        .collect();
    ranking(&entries, &[])
}

/// The feed answer goes out compressed to a client that accepts gzip, and
/// decodes to exactly the JSON an identity answer carries (P-8 measures
/// the bytes per row at the hand test).
///
/// The feed answer is gzip-compressed when the client accepts gzip, decoding to the identical JSON.
/// ´claim:compression:the-feed-answer-compresses´
#[sqlx::test(migrations = "../../migrations")]
async fn the_feed_answer_is_compressed_when_the_client_accepts_gzip(pool: PgPool) {
    let (rig, _pod) = pod_rig(pool, Mode::Answer(a_page_of_entries())).await;
    let f = fixture(&rig.pool).await;
    let body = json!({ "query": RANKING, "variables": { "viewer": f.viewer } });
    let (headers, compressed) = post_graphql(&rig, body.clone(), true, None).await;
    assert_eq!(headers["content-encoding"], "gzip");
    let (_, identity) = post_graphql(&rig, body, false, None).await;
    let decoded = gunzip(&compressed);
    let decoded: Value = serde_json::from_slice(&decoded).expect("JSON inside");
    let identity: Value = serde_json::from_slice(&identity).expect("JSON");
    assert!(decoded["errors"].is_null(), "{decoded}");
    assert_eq!(decoded, identity);
    assert!(
        compressed.len() < serde_json::to_vec(&identity).expect("bytes").len(),
        "compression shrinks the answer"
    );
}

/// A client that names no encoding gets the answer as it is.
///
/// The feed answer is identity-encoded without Accept-Encoding.
/// ´claim:compression:identity-without-accept-encoding´
#[sqlx::test(migrations = "../../migrations")]
async fn the_feed_answer_is_identity_without_accept_encoding(pool: PgPool) {
    let (rig, _pod) = pod_rig(pool, Mode::Answer(a_page_of_entries())).await;
    let f = fixture(&rig.pool).await;
    let body = json!({ "query": RANKING, "variables": { "viewer": f.viewer } });
    let (headers, bytes) = post_graphql(&rig, body, false, None).await;
    assert!(headers.get("content-encoding").is_none(), "{headers:?}");
    let answer: Value = serde_json::from_slice(&bytes).expect("plain JSON");
    assert_eq!(
        answer["data"]["feedRanking"]["entries"]
            .as_array()
            .expect("entries")
            .len(),
        20
    );
}

/// The BREACH posture, at the response: an answer minting a session —
/// the access and refresh tokens — goes out uncompressed even to a client
/// that accepts gzip, because no mutation's answer is ever compressed.
///
/// A mutation's answer is never compressed, so session material never meets the compressor.
/// ´claim:compression:no-mutation-answer-compresses´
#[sqlx::test(migrations = "../../migrations")]
async fn a_session_minting_answer_is_never_compressed(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("minter", "minter@example.test").await;
    let body = json!({
        "query": "mutation($input: LogInInput!) {
                    logIn(input: $input) { auth { accessToken refreshToken } userErrors { code } }
                  }",
        "variables": { "input": { "email": "minter@example.test", "password": rig::MEMBER_PASSWORD } },
    });
    let (headers, bytes) = post_graphql(&rig, body, true, None).await;
    assert!(headers.get("content-encoding").is_none(), "{headers:?}");
    let answer: Value = serde_json::from_slice(&bytes).expect("plain JSON");
    assert!(
        answer["data"]["logIn"]["auth"]["accessToken"].is_string(),
        "{answer}"
    );
}

/// The BREACH posture, at the schema: compression is scoped to queries on
/// the ground that nothing a query can reach carries session material. A
/// walk of every output type reachable from `Query` finds no token and no
/// secret field — while the same walk from `Mutation` does find them, so
/// the walk sees session material where it lives. A field like that
/// joining a query's reach fails here and forces the posture to be argued
/// again.
///
/// No type a query can reach carries a token or a secret.
/// ´claim:compression:no-query-reaches-session-material´
#[test]
fn no_query_reaches_session_material() {
    use async_graphql::parser::parse_schema;
    use async_graphql::parser::types::{BaseType, Type, TypeKind, TypeSystemDefinition};

    fn named(ty: &Type) -> String {
        match &ty.base {
            BaseType::Named(name) => name.to_string(),
            BaseType::List(inner) => named(inner),
        }
    }
    let document = parse_schema(api::schema::sdl()).expect("the schema parses");
    let mut fields: HashMap<String, Vec<(String, String)>> = HashMap::new();
    let mut implementors: HashMap<String, Vec<String>> = HashMap::new();
    for definition in document.definitions {
        let TypeSystemDefinition::Type(ty) = definition else {
            continue;
        };
        let ty = ty.node;
        let name = ty.name.node.to_string();
        let entry = fields.entry(name.clone()).or_default();
        match ty.kind {
            TypeKind::Object(object) => {
                for field in object.fields {
                    entry.push((field.node.name.node.to_string(), named(&field.node.ty.node)));
                }
                for interface in object.implements {
                    implementors
                        .entry(interface.node.to_string())
                        .or_default()
                        .push(name.clone());
                }
            }
            TypeKind::Interface(interface) => {
                for field in interface.fields {
                    entry.push((field.node.name.node.to_string(), named(&field.node.ty.node)));
                }
            }
            TypeKind::Union(union) => {
                for member in union.members {
                    entry.push((String::new(), member.node.to_string()));
                }
            }
            _ => {}
        }
    }
    let secrets_reachable_from = |root: &str| -> Vec<String> {
        let mut seen = HashSet::from([root.to_string()]);
        let mut queue = vec![root.to_string()];
        let mut found = Vec::new();
        while let Some(ty) = queue.pop() {
            let mut next: Vec<String> = implementors.get(&ty).cloned().unwrap_or_default();
            for (field, target) in fields.get(&ty).into_iter().flatten() {
                if field.ends_with("Token") || field.ends_with("Secret") || field == "secret" {
                    found.push(format!("{ty}.{field}"));
                }
                next.push(target.clone());
            }
            for target in next {
                if seen.insert(target.clone()) {
                    queue.push(target);
                }
            }
        }
        found.sort();
        found
    };
    assert_eq!(secrets_reachable_from("Query"), Vec::<String>::new());
    let from_mutations = secrets_reachable_from("Mutation");
    assert!(
        from_mutations.contains(&"AuthSession.accessToken".to_string()),
        "{from_mutations:?}"
    );
}
