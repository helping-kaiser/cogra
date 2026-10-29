//! The generic node accessors over the wire (api-spec.md `node`, `nodes`):
//! every type that implements `Node` — a user, a post, a comment — resolves
//! by its L2 id, in the order asked, with null for an id naming nothing.
//!
//! No ErrorCode is emitted by these reads: an unknown id is a null slot, not
//! an error, and the batch cap is a transport-tier refusal pinned elsewhere.
//!
//! A deleted account is seeded as its erasure husk — a redacted profile
//! version — which the erasure engine will write.

mod rig;

use api::ratelimit::RateLimitConfig;
use postgres_store::content::{self, LandingOrder};
use postgres_store::genesis;
use rig::WireRig;
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

const NODES: &str = r#"query($ids: [UUID!]!) {
  nodes(ids: $ids) {
    __typename
    id
    ... on User { handle displayName { value status } }
    ... on Post { title { value } }
    ... on Comment { content { value } }
  }
}"#;

const NODE: &str = r#"query($id: UUID!) {
  node(id: $id) {
    __typename
    id
    ... on User { handle displayName { value status } }
  }
}"#;

const USER: &str = r#"query($id: UUID!) {
  user(id: $id) {
    __typename
    id
    handle
    displayName { value status }
  }
}"#;

fn rig(pool: PgPool) -> WireRig {
    WireRig::new(pool, RateLimitConfig::unlimited())
}

fn at(secs: i64) -> chrono::DateTime<chrono::Utc> {
    chrono::DateTime::from_timestamp(1_800_000_000 + secs, 0).expect("in range")
}

fn landed() -> LandingOrder {
    LandingOrder {
        landed_epoch: 5,
        act_time: 5,
        position: 0,
    }
}

async fn person(pool: &PgPool, handle: &str) -> Uuid {
    let id = Uuid::new_v4();
    let mut conn = pool.acquire().await.expect("conn");
    genesis::insert_actor(
        &mut conn,
        id,
        "user",
        handle,
        format!("pk-{handle}").as_bytes(),
        &format!("addr-{handle}"),
    )
    .await
    .expect("actor");
    genesis::insert_profile_version(&mut conn, id, handle, None)
        .await
        .expect("profile");
    id
}

async fn post(pool: &PgPool, author: Uuid, title: &str) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_post(
        &mut tx,
        id,
        author,
        &format!("mint:act:{id}:0:publish"),
        "a=0;o=0",
        Some(landed()),
        at(1),
        Some(title),
        None,
        "x",
        None,
    )
    .await
    .expect("post");
    tx.commit().await.expect("commit");
    id
}

async fn comment(pool: &PgPool, author: Uuid, target: Uuid) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_comment(
        &mut tx,
        id,
        target,
        "post",
        author,
        &format!("mint:act:{id}:0:review"),
        "a=0;o=0",
        Some(landed()),
        at(2),
        "a comment",
        None,
    )
    .await
    .expect("comment");
    tx.commit().await.expect("commit");
    id
}

async fn nodes(rig: &WireRig, ids: &[Uuid]) -> Vec<Value> {
    rig.gql(None, NODES, json!({ "ids": ids })).await["nodes"]
        .as_array()
        .expect("list")
        .clone()
}

/// A user, a post, a comment and an unknown id answer user, post, comment
/// and null in the order asked.
/// ´claim:nodes:nodes-resolves-every-node-type-in-order´
#[sqlx::test(migrations = "../../migrations")]
async fn nodes_answers_each_type_in_the_order_asked(pool: PgPool) {
    let rig = rig(pool);
    let author = person(&rig.pool, "author").await;
    let the_post = post(&rig.pool, author, "Hello").await;
    let the_comment = comment(&rig.pool, author, the_post).await;
    let unknown = Uuid::new_v4();

    let got = nodes(&rig, &[author, the_post, the_comment, unknown]).await;

    assert_eq!(got.len(), 4);
    assert_eq!(got[0]["__typename"], "User");
    assert_eq!(got[0]["id"], author.to_string());
    assert_eq!(got[0]["handle"], "author");
    assert_eq!(got[1]["__typename"], "Post");
    assert_eq!(got[1]["id"], the_post.to_string());
    assert_eq!(got[1]["title"]["value"], "Hello");
    assert_eq!(got[2]["__typename"], "Comment");
    assert_eq!(got[2]["id"], the_comment.to_string());
    assert_eq!(got[2]["content"]["value"], "a comment");
    assert!(got[3].is_null(), "an unknown id is a null slot");
}

/// A repeated id fills every slot it was asked for.
/// ´claim:nodes:a-repeated-id-fills-each-of-its-slots´
#[sqlx::test(migrations = "../../migrations")]
async fn nodes_serves_a_repeated_id_in_each_slot(pool: PgPool) {
    let rig = rig(pool);
    let author = person(&rig.pool, "author").await;
    let the_post = post(&rig.pool, author, "Hello").await;

    let got = nodes(&rig, &[author, the_post, author]).await;

    assert_eq!(got[0]["id"], author.to_string());
    assert_eq!(got[1]["id"], the_post.to_string());
    assert_eq!(got[2]["id"], author.to_string());
}

/// The single-node accessor resolves a user id, and null for an id naming nothing.
/// ´claim:nodes:node-resolves-a-user´
#[sqlx::test(migrations = "../../migrations")]
async fn node_resolves_a_user(pool: PgPool) {
    let rig = rig(pool);
    let author = person(&rig.pool, "author").await;

    let got = rig.gql(None, NODE, json!({ "id": author })).await;
    assert_eq!(got["node"]["__typename"], "User");
    assert_eq!(got["node"]["id"], author.to_string());
    assert_eq!(got["node"]["handle"], "author");

    let none = rig.gql(None, NODE, json!({ "id": Uuid::new_v4() })).await;
    assert!(none["node"].is_null());
}

/// A deleted account resolves through the node accessors as its husk — the
/// name gone, the mark standing — exactly as the user lookup serves it.
/// ´claim:nodes:a-deleted-user-reads-as-its-husk-through-node´
#[sqlx::test(migrations = "../../migrations")]
async fn a_deleted_user_reads_as_its_husk_through_node(pool: PgPool) {
    let rig = rig(pool);
    let gone = person(&rig.pool, "gone").await;
    sqlx::query(
        "INSERT INTO actor_profile_versions
             (actor_id, display_name, redaction_reason, landed_epoch, act_time, position)
         VALUES ($1, '[redacted]', 'erasure', 99, 99, 0)",
    )
    .bind(gone)
    .execute(&rig.pool)
    .await
    .expect("husk");

    let via_user = rig.gql(None, USER, json!({ "id": gone })).await["user"].clone();
    assert_eq!(via_user["displayName"]["status"], "REDACTED");

    let via_node = rig.gql(None, NODE, json!({ "id": gone })).await["node"].clone();
    assert_eq!(via_node, via_user);

    let via_nodes = nodes(&rig, &[gone]).await;
    assert_eq!(via_nodes[0]["__typename"], "User");
    assert_eq!(via_nodes[0]["displayName"], via_user["displayName"]);
}
