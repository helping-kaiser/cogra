//! The backend's part in ranking, end to end through the real HTTP
//! surface (api-spec.md "Feed"): the governed parameters a ranker reads
//! (`networkParameters`), the viewer's slice it ranks over (`feedSlice`),
//! and the hydration of the order it hands back (`feed`).
//!
//! The slice fixtures land records straight into the mirror, one epoch
//! package at a time, so each test names exactly the legs it walks.

mod rig;

use api::bootstrap::{GenesisInput, run as bootstrap};
use api::ratelimit::RateLimitConfig;
use common::l1::Family;
use common::l1::census::LegRole;
use common::l1::handshake::{EpochPackage, PublishedLeg, PublishedRecord};
use common::l1::identifier::{ActId, NodeId};
use postgres_store::content::{self, LandingOrder};
use postgres_store::{genesis, hashtag, mirror};
use rig::WireRig;
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
    slice(rig, json!({ "viewer": viewer, "first": 100, "rfirst": 100 })).await
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
    let page = |after: Value| {
        json!({ "viewer": f.viewer, "asOf": pin, "first": 3, "after": after, "rfirst": 1 })
    };
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
                vec![binary("a", 9, Family::Publish, minted("a", 9, Family::Publish))],
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
    let cursor = mirror::last_ingested_epoch(&rig.pool).await.expect("cursor");
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
