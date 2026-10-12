//! The seen-list over the wire (api-spec.md `User.viewHistory`,
//! `markSeen`; history-surface packet H1): first seeing only, newest
//! first, a batch's own order, the kind filter, the hidden-actor
//! exclusion, removed things kept, the frozen keyset, the viewer-only
//! read, and the four refusals.
//!
//! Content is seeded through the store's own writers. Two states have no
//! verb yet and are seeded by raw SQL: a hidden actor (`hideActor` is the
//! hidden-actors packet's) is a raw `user_hidden_actors` row, and a
//! removal (the moderation slice writes it) is a raw tombstone version.

mod rig;

use api::ratelimit::{RateLimitConfig, Window};
use common::hashtag_uuid;
use postgres_store::content::{self, LandingOrder};
use postgres_store::{genesis, hashtag};
use rig::WireRig;
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

type Timestamp = chrono::DateTime<chrono::Utc>;

const MARK_SEEN: &str = r#"mutation($nodes: [UUID!]!) {
  markSeen(input: { nodes: $nodes }) { ok userErrors { code field } }
}"#;

const HISTORY: &str = r#"query($kinds: [NodeKind!], $first: Int, $after: String,
                                $last: Int, $before: String) {
  me {
    viewHistory(kinds: $kinds, first: $first, after: $after, last: $last, before: $before) {
      edges {
        cursor
        firstSeenAt
        node {
          __typename
          ... on Post { id title { value } }
          ... on Comment { id }
          ... on User { id handle }
          ... on Hashtag { id name { value } }
        }
      }
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      totalCount
    }
  }
}"#;

fn rig(pool: PgPool) -> WireRig {
    WireRig::new(pool, RateLimitConfig::unlimited())
}

fn at(secs: i64) -> Timestamp {
    chrono::DateTime::from_timestamp(1_800_000_000 + secs, 0).expect("in range")
}

fn landed(secs: i64) -> LandingOrder {
    LandingOrder {
        landed_epoch: secs,
        act_time: secs,
        position: 0,
    }
}

/// A keyed person with no account.
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
    id
}

/// A post authored at `secs`: landed, or still pending when `pending`.
async fn post_at(pool: &PgPool, author: Uuid, secs: i64, title: &str, pending: bool) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_post(
        &mut tx,
        id,
        author,
        &format!("mint:act:{id}:0:publish"),
        "a=0;o=0",
        (!pending).then(|| landed(secs)),
        at(secs),
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

async fn post(pool: &PgPool, author: Uuid, secs: i64, title: &str) -> Uuid {
    post_at(pool, author, secs, title, false).await
}

/// A landed comment on `target` (a post, or a comment for a reply).
async fn comment(pool: &PgPool, author: Uuid, target: Uuid, target_type: &str) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_comment(
        &mut tx,
        id,
        target,
        target_type,
        author,
        &format!("mint:act:{id}:0:review"),
        "a=0;o=0",
        Some(landed(5)),
        at(5),
        "a comment",
        None,
    )
    .await
    .expect("comment");
    tx.commit().await.expect("commit");
    id
}

async fn tag(pool: &PgPool, name: &str) -> Uuid {
    let mut conn = pool.acquire().await.expect("conn");
    hashtag::upsert(&mut conn, name).await.expect("tag");
    hashtag_uuid(name)
}

async fn hide(pool: &PgPool, viewer: Uuid, hidden: Uuid) {
    sqlx::query("INSERT INTO user_hidden_actors (viewer_id, hidden_id) VALUES ($1, $2)")
        .bind(viewer)
        .bind(hidden)
        .execute(pool)
        .await
        .expect("hide");
}

async fn unhide(pool: &PgPool, viewer: Uuid, hidden: Uuid) {
    sqlx::query("DELETE FROM user_hidden_actors WHERE viewer_id = $1 AND hidden_id = $2")
        .bind(viewer)
        .bind(hidden)
        .execute(pool)
        .await
        .expect("unhide");
}

/// A member with a session.
async fn reader(rig: &WireRig, handle: &str) -> (Uuid, String) {
    let email = format!("{handle}@example.test");
    let (id, _) = rig.seed_member(handle, &email).await;
    (id, rig.log_in(&email).await)
}

async fn mark(rig: &WireRig, token: &str, ids: &[Uuid]) -> Value {
    rig.gql(Some(token), MARK_SEEN, json!({ "nodes": ids }))
        .await["markSeen"]
        .clone()
}

async fn history(rig: &WireRig, token: &str, variables: Value) -> Value {
    rig.gql(Some(token), HISTORY, variables).await["me"]["viewHistory"].clone()
}

/// The ids the page names, in order.
fn ids(connection: &Value) -> Vec<Uuid> {
    connection["edges"]
        .as_array()
        .expect("edges")
        .iter()
        .map(|edge| Uuid::parse_str(edge["node"]["id"].as_str().expect("id")).expect("uuid"))
        .collect()
}

fn typenames(connection: &Value) -> Vec<String> {
    connection["edges"]
        .as_array()
        .expect("edges")
        .iter()
        .map(|edge| {
            edge["node"]["__typename"]
                .as_str()
                .expect("typename")
                .to_string()
        })
        .collect()
}

fn first_error_code(response: &Value) -> Option<&str> {
    response["errors"][0]["extensions"]["code"].as_str()
}

async fn count(pool: &PgPool, table: &str) -> i64 {
    sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
        .fetch_one(pool)
        .await
        .expect("count")
}

/// What is seen later stands above what was seen earlier.
///
/// History stands newest first by first seeing.
/// ´claim:history:newest-first-by-first-seeing´
#[sqlx::test(migrations = "../../migrations")]
async fn history_reads_newest_first_by_first_seeing(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    // Authored the other way round: authoring time never orders History.
    let older_seen = post(&rig.pool, sol, 9, "Seen first").await;
    let newer_seen = post(&rig.pool, sol, 1, "Seen second").await;

    assert_eq!(mark(&rig, &token, &[older_seen]).await["ok"], true);
    assert_eq!(mark(&rig, &token, &[newer_seen]).await["ok"], true);

    let page = history(&rig, &token, json!({})).await;
    assert_eq!(ids(&page), vec![newer_seen, older_seen]);
    assert_eq!(page["totalCount"], 2);
}

/// One flush carries the ids in the order they were seen, and reads back
/// in that order — never by UUID. A repeat inside the batch keeps its
/// first place.
///
/// A batch keeps the order it was seen in.
/// ´claim:history:a-batch-keeps-the-order-it-was-seen-in´
#[sqlx::test(migrations = "../../migrations")]
async fn a_batch_keeps_the_order_it_was_seen_in(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let mut seen = Vec::new();
    for n in 0..8 {
        seen.push(post(&rig.pool, sol, n, &format!("Post {n}")).await);
    }
    let mut batch = seen.clone();
    batch.push(seen[0]);
    assert_eq!(mark(&rig, &token, &batch).await["ok"], true);

    let page = history(&rig, &token, json!({})).await;
    let mut newest_first = seen.clone();
    newest_first.reverse();
    assert_eq!(ids(&page), newest_first);
}

/// Seeing a thing already on the list counts nothing: it keeps its place
/// and its first-seen instant, and stands once.
///
/// Re-seeing never moves an entry.
/// ´claim:history:re-seeing-never-moves-an-entry´
#[sqlx::test(migrations = "../../migrations")]
async fn marking_a_seen_node_again_never_moves_it(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let a = post(&rig.pool, sol, 1, "A").await;
    let b = post(&rig.pool, sol, 2, "B").await;
    mark(&rig, &token, &[a]).await;
    mark(&rig, &token, &[b]).await;
    let before = history(&rig, &token, json!({})).await;

    assert_eq!(mark(&rig, &token, &[a]).await["ok"], true);
    let after = history(&rig, &token, json!({})).await;
    assert_eq!(ids(&after), vec![b, a]);
    assert_eq!(
        after["edges"][1]["firstSeenAt"],
        before["edges"][1]["firstSeenAt"]
    );
    assert_eq!(after["totalCount"], 2);
}

/// Each served kind narrows to itself, and kinds combine.
///
/// The kind filter narrows to the staged kinds.
/// ´claim:history:kinds-narrow´
#[sqlx::test(migrations = "../../migrations")]
async fn history_narrows_to_the_staged_kinds(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let p = post(&rig.pool, sol, 1, "P").await;
    let c = comment(&rig.pool, sol, p, "post").await;
    let t = tag(&rig.pool, "saltmaps").await;
    mark(&rig, &token, &[p, c, sol, t]).await;

    for (kind, expected) in [("POST", p), ("COMMENT", c), ("USER", sol), ("HASHTAG", t)] {
        let page = history(&rig, &token, json!({ "kinds": [kind] })).await;
        assert_eq!(ids(&page), vec![expected], "for {kind}");
        assert_eq!(page["totalCount"], 1, "for {kind}");
    }
    let two = history(&rig, &token, json!({ "kinds": ["POST", "HASHTAG"] })).await;
    assert_eq!(ids(&two), vec![t, p]);
}

/// An empty kind list means the same as null.
///
/// An empty kind list narrows nothing.
/// ´claim:history:an-empty-kind-list-narrows-nothing´
#[sqlx::test(migrations = "../../migrations")]
async fn an_empty_kind_list_narrows_nothing(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let p = post(&rig.pool, sol, 1, "P").await;
    let t = tag(&rig.pool, "saltmaps").await;
    mark(&rig, &token, &[p, sol, t]).await;

    let all = history(&rig, &token, json!({})).await;
    let empty = history(&rig, &token, json!({ "kinds": [] })).await;
    assert_eq!(ids(&empty), ids(&all));
    assert_eq!(ids(&all), vec![t, sol, p]);
}

/// A reply is a comment targeting a comment, and History serves it as a
/// comment.
///
/// A reply appears as a comment.
/// ´claim:history:a-reply-appears-as-a-comment´
#[sqlx::test(migrations = "../../migrations")]
async fn a_reply_appears_as_a_comment(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let p = post(&rig.pool, sol, 1, "P").await;
    let c = comment(&rig.pool, sol, p, "post").await;
    let reply = comment(&rig.pool, sol, c, "comment").await;
    mark(&rig, &token, &[reply]).await;

    let page = history(&rig, &token, json!({ "kinds": ["COMMENT"] })).await;
    assert_eq!(ids(&page), vec![reply]);
    assert_eq!(typenames(&page), vec!["Comment"]);
}

/// A topic is seeable by its id and reads back as the union's Hashtag
/// member, never as a Node.
///
/// A seen tag reads back as a Hashtag.
/// ´claim:history:a-seen-tag-reads-back-as-a-hashtag´
#[sqlx::test(migrations = "../../migrations")]
async fn a_seen_tag_reads_back_as_a_hashtag(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let t = tag(&rig.pool, "saltmaps").await;
    mark(&rig, &token, &[t]).await;

    let page = history(&rig, &token, json!({})).await;
    assert_eq!(typenames(&page), vec!["Hashtag"]);
    assert_eq!(page["edges"][0]["node"]["name"]["value"], "saltmaps");
    assert_eq!(ids(&page), vec![t]);
}

/// A kind History does not serve is a malformed argument.
///
/// An unserved kind is BAD_INPUT.
/// ´claim:history:an-unserved-kind-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn history_with_an_unserved_kind_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    for kind in ["CHAT", "COLLECTIVE", "OFFER"] {
        let response = rig
            .gql_raw(Some(&token), HISTORY, json!({ "kinds": ["POST", kind] }))
            .await;
        assert_eq!(first_error_code(&response), Some("BAD_INPUT"), "for {kind}");
    }
}

/// A cursor this list did not issue is a malformed argument, in either
/// direction.
///
/// A malformed cursor is BAD_INPUT.
/// ´claim:history:a-malformed-cursor-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn history_with_a_malformed_cursor_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    for variables in [
        json!({ "after": "not a cursor" }),
        json!({ "last": 2, "before": "bm90IG91cnM=" }),
    ] {
        let response = rig.gql_raw(Some(&token), HISTORY, variables.clone()).await;
        assert_eq!(
            first_error_code(&response),
            Some("BAD_INPUT"),
            "for {variables}"
        );
    }
}

/// While an account is hidden its posts and comments are out of History;
/// their own profile is not their post or comment and stays (History.md,
/// a hidden account's own profile card stays).
///
/// A hidden actor's things leave History while hidden.
/// ´claim:history:a-hidden-actors-things-leave-while-hidden´
#[sqlx::test(migrations = "../../migrations")]
async fn a_hidden_actors_things_leave_history_while_hidden(pool: PgPool) {
    let rig = rig(pool);
    let (me, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let ada = person(&rig.pool, "ada").await;
    let sols = post(&rig.pool, sol, 1, "Sol's").await;
    let adas = post(&rig.pool, ada, 2, "Ada's").await;
    let sols_comment = comment(&rig.pool, sol, adas, "post").await;
    mark(&rig, &token, &[sols, adas, sols_comment]).await;

    hide(&rig.pool, me, sol).await;
    let page = history(&rig, &token, json!({})).await;
    assert_eq!(ids(&page), vec![adas]);
    assert_eq!(page["totalCount"], 1);
}

/// Unhiding returns the account's things to the places they were first
/// seen in.
///
/// An unhidden actor's things return in their place.
/// ´claim:history:an-unhidden-actors-things-return-in-their-place´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unhidden_actors_things_return_in_their_place(pool: PgPool) {
    let rig = rig(pool);
    let (me, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let ada = person(&rig.pool, "ada").await;
    let a = post(&rig.pool, ada, 1, "A").await;
    let s = post(&rig.pool, sol, 2, "S").await;
    let b = post(&rig.pool, ada, 3, "B").await;
    mark(&rig, &token, &[a, s, b]).await;

    hide(&rig.pool, me, sol).await;
    assert_eq!(ids(&history(&rig, &token, json!({})).await), vec![b, a]);
    unhide(&rig.pool, me, sol).await;
    assert_eq!(ids(&history(&rig, &token, json!({})).await), vec![b, s, a]);
}

/// The hidden account's own profile card stays (History.md; HG-5 as
/// ruled), while their posts leave.
///
/// A hidden account's own profile stays in History.
/// ´claim:history:a-hidden-actors-profile-stays´
#[sqlx::test(migrations = "../../migrations")]
async fn a_hidden_actors_profile_stays_in_history(pool: PgPool) {
    let rig = rig(pool);
    let (me, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let sols = post(&rig.pool, sol, 1, "Sol's").await;
    mark(&rig, &token, &[sol, sols]).await;

    hide(&rig.pool, me, sol).await;
    let page = history(&rig, &token, json!({})).await;
    assert_eq!(ids(&page), vec![sol]);
    assert_eq!(typenames(&page), vec!["User"]);
}

/// A removal is a new tombstone version, never a deleted row, so the
/// removed thing keeps its place.
///
/// A removed thing keeps its place in History.
/// ´claim:history:a-removed-thing-keeps-its-place´
#[sqlx::test(migrations = "../../migrations")]
async fn a_removed_post_keeps_its_place_in_history(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let a = post(&rig.pool, sol, 1, "A").await;
    let removed = post(&rig.pool, sol, 2, "Removed").await;
    let b = post(&rig.pool, sol, 3, "B").await;
    mark(&rig, &token, &[a, removed, b]).await;
    sqlx::query(
        "INSERT INTO post_versions
             (post_id, title, content, redaction_reason, pending, created_at,
              landed_epoch, act_time, position)
         VALUES ($1, '[removed]', '[removed]', 'policy', FALSE, $2, 9, 9, 0)",
    )
    .bind(removed)
    .bind(at(9))
    .execute(&rig.pool)
    .await
    .expect("tombstone");

    assert_eq!(
        ids(&history(&rig, &token, json!({})).await),
        vec![b, removed, a]
    );
}

/// A pending post the reader saw may be discarded before it lands: its
/// entry is skipped on read, and marking it afterwards is no error.
///
/// A discarded pending write is skipped, never an error.
/// ´claim:history:a-discarded-pending-write-is-skipped´
#[sqlx::test(migrations = "../../migrations")]
async fn a_discarded_pending_post_is_skipped_not_an_error(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let kept = post(&rig.pool, sol, 1, "Kept").await;
    let pending = post_at(&rig.pool, sol, 2, "Pending", true).await;
    mark(&rig, &token, &[kept, pending]).await;
    assert_eq!(
        ids(&history(&rig, &token, json!({})).await),
        vec![pending, kept]
    );

    let mut tx = rig.pool.begin().await.expect("tx");
    content::discard_pending(&mut tx, pending, at(2))
        .await
        .expect("discard");
    tx.commit().await.expect("commit");

    let page = history(&rig, &token, json!({})).await;
    assert_eq!(ids(&page), vec![kept]);
    assert_eq!(page["totalCount"], 1);
    let again = mark(&rig, &token, &[pending]).await;
    assert_eq!(again["ok"], true);
    assert_eq!(again["userErrors"], json!([]));
}

/// Paging is keyset on (firstSeenAt, node id): a thing first seen while
/// the reader pages sorts above the open page, so the next page is
/// exactly the rest; it joins at the next open.
///
/// A thing seen mid-scroll never shifts the next page.
/// ´claim:history:frozen-paging´
#[sqlx::test(migrations = "../../migrations")]
async fn a_thing_seen_mid_scroll_never_shifts_the_next_page(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let mut seen = Vec::new();
    for n in 0..5 {
        seen.push(post(&rig.pool, sol, n, &format!("Post {n}")).await);
    }
    mark(&rig, &token, &seen).await;
    let fresh = post(&rig.pool, sol, 9, "Fresh").await;

    let first = history(&rig, &token, json!({ "first": 2 })).await;
    assert_eq!(ids(&first), vec![seen[4], seen[3]]);
    assert_eq!(first["pageInfo"]["hasNextPage"], true);
    mark(&rig, &token, &[fresh]).await;
    let second = history(
        &rig,
        &token,
        json!({ "first": 2, "after": first["pageInfo"]["endCursor"] }),
    )
    .await;
    assert_eq!(ids(&second), vec![seen[2], seen[1]]);
    assert_eq!(second["pageInfo"]["hasPreviousPage"], true);

    let back = history(
        &rig,
        &token,
        json!({ "last": 2, "before": second["pageInfo"]["startCursor"] }),
    )
    .await;
    assert_eq!(ids(&back), vec![seen[4], seen[3]]);

    let reopened = history(&rig, &token, json!({ "first": 1 })).await;
    assert_eq!(ids(&reopened), vec![fresh]);
}

/// Another account's seen-list is null, field-level — never an error,
/// never their rows; so is the list without a session.
///
/// The seen-list is viewer-only.
/// ´claim:history:viewer-only´
#[sqlx::test(migrations = "../../migrations")]
async fn view_history_is_viewer_only(pool: PgPool) {
    let rig = rig(pool);
    let (_, owner) = reader(&rig, "owner").await;
    let (_, other) = reader(&rig, "other").await;
    let sol = person(&rig.pool, "sol").await;
    let p = post(&rig.pool, sol, 1, "P").await;
    mark(&rig, &owner, &[p]).await;

    let query = r#"query { user(handle: "owner") { handle viewHistory { totalCount } } }"#;
    let as_other = rig.gql_raw(Some(&other), query, json!({})).await;
    assert!(as_other["errors"].is_null(), "{as_other}");
    assert_eq!(as_other["data"]["user"]["handle"], "owner");
    assert!(as_other["data"]["user"]["viewHistory"].is_null());
    let anonymous = rig.gql_raw(None, query, json!({})).await;
    assert!(anonymous["data"]["user"]["viewHistory"].is_null());
    let as_owner = rig.gql_raw(Some(&owner), query, json!({})).await;
    assert_eq!(as_owner["data"]["user"]["viewHistory"]["totalCount"], 1);
}

/// Seeing is private viewer state, not acting: an applicant marks and
/// reads like a member.
///
/// An applicant marks seen and reads History.
/// ´claim:history:applicants-have-history´
#[sqlx::test(migrations = "../../migrations")]
async fn an_applicant_marks_seen_and_reads_history(pool: PgPool) {
    let rig = rig(pool);
    let (me, token) = reader(&rig, "applicant").await;
    sqlx::query("UPDATE user_credentials SET account_state = 'applicant' WHERE actor_id = $1")
        .bind(me)
        .execute(&rig.pool)
        .await
        .expect("applicant");
    let sol = person(&rig.pool, "sol").await;
    let p = post(&rig.pool, sol, 1, "P").await;

    let marked = mark(&rig, &token, &[p, sol]).await;
    assert_eq!(marked["ok"], true, "{marked}");
    assert_eq!(ids(&history(&rig, &token, json!({})).await), vec![sol, p]);
}

/// Without a session there is no seen-list to write to.
///
/// markSeen without a session is UNAUTHENTICATED.
/// ´claim:history:mark-seen-needs-a-session´
#[sqlx::test(migrations = "../../migrations")]
async fn mark_seen_without_a_session_is_unauthenticated(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol").await;
    let response = rig
        .gql_raw(None, MARK_SEEN, json!({ "nodes": [sol] }))
        .await;
    assert_eq!(first_error_code(&response), Some("UNAUTHENTICATED"));
    assert_eq!(count(&rig.pool, "user_view_log").await, 0);
}

/// One call carries at most a page of ids; past it the batch is refused
/// whole, at the `nodes` field, and writes nothing.
///
/// Over the cap is BAD_INPUT at nodes.
/// ´claim:history:mark-seen-cap´
#[sqlx::test(migrations = "../../migrations")]
async fn mark_seen_over_the_cap_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let mut batch = vec![sol];
    batch.extend((0..100).map(|_| Uuid::new_v4()));

    let refused = mark(&rig, &token, &batch).await;
    assert!(refused["ok"].is_null());
    assert_eq!(
        refused["userErrors"],
        json!([{ "code": "BAD_INPUT", "field": ["nodes"] }])
    );
    assert_eq!(count(&rig.pool, "user_view_log").await, 0);
    assert_eq!(mark(&rig, &token, &batch[..100]).await["ok"], true);
}

/// An id naming nothing seeable — no node at all, or a kind History does
/// not hold — is skipped, and the rest of the batch is written.
///
/// markSeen skips ids that name nothing.
/// ´claim:history:mark-seen-skips-ids-that-name-nothing´
#[sqlx::test(migrations = "../../migrations")]
async fn mark_seen_skips_ids_that_name_nothing(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let p = post(&rig.pool, sol, 1, "P").await;
    let collective = Uuid::new_v4();
    let mut conn = rig.pool.acquire().await.expect("conn");
    genesis::insert_actor(
        &mut conn,
        collective,
        "collective",
        "salters",
        b"pk-c",
        "addr-c",
    )
    .await
    .expect("collective");
    drop(conn);

    let marked = mark(&rig, &token, &[Uuid::new_v4(), p, collective]).await;
    assert_eq!(marked["ok"], true);
    assert_eq!(marked["userErrors"], json!([]));
    assert_eq!(ids(&history(&rig, &token, json!({})).await), vec![p]);
    assert_eq!(count(&rig.pool, "user_view_log").await, 1);
}

/// Seeing stays in the app: no staged write, no record.
///
/// Marking seen never becomes a graph record.
/// ´claim:history:seeing-is-never-a-graph-record´
#[sqlx::test(migrations = "../../migrations")]
async fn marking_seen_writes_no_staged_write_and_no_record(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let p = post(&rig.pool, sol, 1, "P").await;
    let (staged, records, legs) = (
        count(&rig.pool, "staged_writes").await,
        count(&rig.pool, "mirror_records").await,
        count(&rig.pool, "mirror_record_legs").await,
    );

    mark(&rig, &token, &[p, sol]).await;
    rig.close_and_ingest().await;
    assert_eq!(count(&rig.pool, "staged_writes").await, staged);
    assert_eq!(count(&rig.pool, "mirror_records").await, records);
    assert_eq!(count(&rig.pool, "mirror_record_legs").await, legs);
    assert_eq!(count(&rig.pool, "user_view_log").await, 2);
}

/// The account's markSeen budget: past it the call is RATE_LIMITED at the
/// transport and writes nothing; a refusal spends nothing.
///
/// markSeen trips the account budget.
/// ´claim:history:mark-seen-account-budget´
#[sqlx::test(migrations = "../../migrations")]
async fn mark_seen_trips_the_account_budget(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.mark_seen_account = Window {
        limit: 2,
        window_secs: 3600.0,
    };
    let rig = WireRig::new(pool, limits);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let a = post(&rig.pool, sol, 1, "A").await;
    let b = post(&rig.pool, sol, 2, "B").await;
    let c = post(&rig.pool, sol, 3, "C").await;

    assert_eq!(mark(&rig, &token, &[a]).await["ok"], true);
    assert_eq!(mark(&rig, &token, &[b]).await["ok"], true);
    let refused = rig
        .gql_raw(Some(&token), MARK_SEEN, json!({ "nodes": [c] }))
        .await;
    assert_eq!(first_error_code(&refused), Some("RATE_LIMITED"));
    assert_eq!(ids(&history(&rig, &token, json!({})).await), vec![b, a]);
}
