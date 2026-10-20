//! The seen-list over the wire (api-spec.md `User.viewHistory`,
//! `markSeen`; history-surface packet H1): first seeing only, newest
//! first, a batch's own order, the kind filter, the hidden-actor
//! exclusion, removed things kept, the frozen keyset, the viewer-only
//! read, and the four refusals — and the list narrowed by a query
//! through the one search matcher (api-spec.md "Search", History).
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

/// What is seen later stands above what was seen earlier. The posts are
/// authored the other way round: authoring time never orders History.
///
/// History stands newest first by first seeing.
/// ´claim:history:newest-first-by-first-seeing´
#[sqlx::test(migrations = "../../migrations")]
async fn history_reads_newest_first_by_first_seeing(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
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
async fn an_empty_kind_list_narrows_no_history(pool: PgPool) {
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

const HISTORY_QUERY: &str = r#"query($query: String, $kinds: [NodeKind!], $first: Int,
                                    $after: String, $last: Int, $before: String) {
  me {
    viewHistory(query: $query, kinds: $kinds, first: $first, after: $after,
                last: $last, before: $before) {
      edges {
        cursor
        firstSeenAt
        node {
          __typename
          ... on Post { id }
          ... on Comment { id }
          ... on User { id }
          ... on Hashtag { id }
        }
      }
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      totalCount
      hasMorePeople
      hasMoreTags
    }
  }
}"#;

async fn history_query_raw(rig: &WireRig, token: &str, variables: Value) -> Value {
    rig.gql_raw(Some(token), HISTORY_QUERY, variables).await
}

async fn history_query(rig: &WireRig, token: &str, variables: Value) -> Value {
    let response = history_query_raw(rig, token, variables.clone()).await;
    assert!(response.get("errors").is_none(), "{variables}: {response}");
    response["data"]["me"]["viewHistory"].clone()
}

/// Gives `actor` a display name, so plain text can reach them by it.
async fn display_name(pool: &PgPool, actor: Uuid, name: &str) {
    let mut conn = pool.acquire().await.expect("conn");
    genesis::insert_profile_version(&mut conn, actor, name, None)
        .await
        .expect("profile");
}

/// Walks the narrowed list forward `size` at a time, then backward, and
/// answers both walks.
async fn walk_both_ways(
    rig: &WireRig,
    token: &str,
    query: &str,
    size: i32,
) -> (Vec<Uuid>, Vec<Uuid>) {
    let mut forward = Vec::new();
    let mut after = Value::Null;
    loop {
        let page = history_query(
            rig,
            token,
            json!({ "query": query, "first": size, "after": after }),
        )
        .await;
        forward.extend(ids(&page));
        if page["pageInfo"]["hasNextPage"] != true {
            break;
        }
        after = page["pageInfo"]["endCursor"].clone();
    }
    let mut back = Vec::new();
    let mut before = Value::Null;
    loop {
        let page = history_query(
            rig,
            token,
            json!({ "query": query, "last": size, "before": before }),
        )
        .await;
        let mut chunk = ids(&page);
        chunk.append(&mut back);
        back = chunk;
        if page["pageInfo"]["hasPreviousPage"] != true {
            break;
        }
        before = page["pageInfo"]["startCursor"].clone();
    }
    (forward, back)
}

/// The narrowing runs on the server over the whole seen-list: a match
/// seen long before the first page reaches is found on the first page,
/// counted alone, and a match the reader never saw is not.
///
/// A History query finds a match wherever it stands in the list, and never a thing the reader has not seen.
/// ´claim:history:a-history-query-runs-over-the-whole-list´
#[sqlx::test(migrations = "../../migrations")]
async fn a_history_query_finds_a_match_beyond_the_loaded_window(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let kel = person(&rig.pool, "kel").await;
    let old = post(&rig.pool, kel, 0, "Salt maps of the coast road").await;
    mark(&rig, &token, &[old]).await;
    let mut later = Vec::new();
    for n in 1..=30 {
        later.push(post(&rig.pool, kel, n, &format!("Rubbing {n}")).await);
    }
    mark(&rig, &token, &later).await;
    let unseen = post(&rig.pool, kel, 40, "Salt flats").await;

    let window = history(&rig, &token, json!({ "first": 5 })).await;
    assert!(!ids(&window).contains(&old), "beyond the plain first page");
    let found = history_query(&rig, &token, json!({ "query": "salt", "first": 5 })).await;
    assert_eq!(ids(&found), vec![old]);
    assert!(!ids(&found).contains(&unseen), "never what was not seen");
    assert_eq!(found["totalCount"], 1);
    assert_eq!(found["pageInfo"]["hasNextPage"], false);
    assert_eq!(found["hasMorePeople"], false);
    for blank in [json!(null), json!(""), json!("   ")] {
        let plain = history_query(&rig, &token, json!({ "query": blank, "first": 5 })).await;
        assert_eq!(ids(&plain), ids(&window), "a blank query narrows nothing");
        assert_eq!(plain["totalCount"], 31);
    }
}

/// History runs the one search law over the seen set: a narrowed list is
/// sectioned — people, then topics, then content — newest first seeing
/// inside each. A person cue lists the seen profiles it names, then the
/// seen things they authored; plain text reaches a person's seen posts
/// through their display name; a bare topic cue lists the seen topics it
/// names.
///
/// A narrowed History list follows the search law: people, then topics, then content, newest first seeing first.
/// ´claim:history:a-narrowed-history-follows-the-search-law´
#[sqlx::test(migrations = "../../migrations")]
async fn a_narrowed_history_follows_the_search_law(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let solarium = person(&rig.pool, "solarium").await;
    display_name(&rig.pool, solarium, "solarium").await;
    let kel = person(&rig.pool, "kel").await;
    let theirs = post(&rig.pool, solarium, 1, "Rubbings").await;
    let their_comment = comment(&rig.pool, solarium, theirs, "post").await;
    let unseen = post(&rig.pool, solarium, 2, "Wax charts").await;
    let kels = post(&rig.pool, kel, 3, "Solar charts").await;
    let flare = tag(&rig.pool, "solarflare").await;
    tag(&rig.pool, "solstice").await;
    mark(
        &rig,
        &token,
        &[theirs, solarium, their_comment, kels, flare],
    )
    .await;

    let cue = history_query(&rig, &token, json!({ "query": "@sol" })).await;
    assert_eq!(ids(&cue), vec![solarium, their_comment, theirs]);
    assert!(!ids(&cue).contains(&unseen));
    assert_eq!(cue["totalCount"], 3);
    let text = history_query(&rig, &token, json!({ "query": "sol" })).await;
    assert_eq!(
        ids(&text),
        vec![solarium, flare, kels, theirs],
        "the person, the seen topic, then the title match and the display-name author's post"
    );
    assert_eq!(
        typenames(&text),
        vec!["User", "Hashtag", "Post", "Post"],
        "sections stand people, topics, content"
    );
    assert_eq!(text["totalCount"], 4);
    let topics = history_query(&rig, &token, json!({ "query": "#sol" })).await;
    assert_eq!(ids(&topics), vec![flare], "only the seen topic");
    assert_eq!(topics["totalCount"], 1);
}

/// The narrowed list keeps History's hidden-actor narrowing: while an
/// account is hidden its posts and comments match nothing, under plain
/// text or a cue, and their own profile still does.
///
/// A hidden actor's things never match in History while hidden; their profile still does.
/// ´claim:history:a-hidden-actors-things-never-match´
#[sqlx::test(migrations = "../../migrations")]
async fn a_hidden_actors_things_never_match_in_history(pool: PgPool) {
    let rig = rig(pool);
    let (me, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let ada = person(&rig.pool, "ada").await;
    let sols = post(&rig.pool, sol, 1, "Salt by sol").await;
    let adas = post(&rig.pool, ada, 2, "Salt by ada").await;
    let sols_comment = comment(&rig.pool, sol, adas, "post").await;
    mark(&rig, &token, &[sol, sols, adas, sols_comment]).await;

    let before = history_query(&rig, &token, json!({ "query": "@sol" })).await;
    assert_eq!(ids(&before), vec![sol, sols_comment, sols]);
    hide(&rig.pool, me, sol).await;
    let text = history_query(&rig, &token, json!({ "query": "salt" })).await;
    assert_eq!(ids(&text), vec![adas]);
    assert_eq!(text["totalCount"], 1);
    let cue = history_query(&rig, &token, json!({ "query": "@sol" })).await;
    assert_eq!(ids(&cue), vec![sol], "the profile stays, the things leave");
    assert_eq!(cue["totalCount"], 1);
    unhide(&rig.pool, me, sol).await;
    let back = history_query(&rig, &token, json!({ "query": "@sol" })).await;
    assert_eq!(ids(&back), ids(&before), "unhiding returns them in place");
}

/// A narrowed list pages on its own keyset: every page forward and every
/// page backward yields the one-shot order, sections included. Its
/// cursors, the plain list's and Saved's never pass for each other, and
/// a query past the search cap is refused.
///
/// A narrowed History list pages stably both ways, on cursors of its own.
/// ´claim:history:a-narrowed-list-pages-on-its-own-keyset´
#[sqlx::test(migrations = "../../migrations")]
async fn a_narrowed_history_pages_on_its_own_keyset(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let salter = person(&rig.pool, "salter").await;
    let kel = person(&rig.pool, "kel").await;
    for n in 0..7 {
        let p = post(&rig.pool, kel, n, &format!("Salt study {n}")).await;
        mark(&rig, &token, &[p]).await;
        if n == 3 {
            mark(&rig, &token, &[salter]).await;
        }
    }
    let whole = history_query(&rig, &token, json!({ "query": "salt", "first": 100 })).await;
    let expected = ids(&whole);
    assert_eq!(expected.len(), 8);
    assert_eq!(expected[0], salter, "the people section leads");

    let (forward, back) = walk_both_ways(&rig, &token, "salt", 3).await;
    assert_eq!(forward, expected, "forward");
    assert_eq!(back, expected, "backward");

    let narrowed_cursor = whole["edges"][0]["cursor"].clone();
    let plain = history(&rig, &token, json!({ "first": 1 })).await;
    let plain_cursor = plain["edges"][0]["cursor"].clone();
    let saved_cursor = json!(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        format!("savedq:0:0:{salter}")
    ));
    for variables in [
        json!({ "query": "salt", "after": plain_cursor }),
        json!({ "query": "salt", "after": saved_cursor }),
        json!({ "after": narrowed_cursor }),
        json!({ "query": "s".repeat(api::search::MAX_QUERY_CHARS + 1) }),
    ] {
        let refused = history_query_raw(&rig, &token, variables.clone()).await;
        assert_eq!(first_error_code(&refused), Some("BAD_INPUT"), "{variables}");
    }
}

/// The people section of a narrowed list serves the three people first
/// seen most recently among those the query matches, then the rest;
/// `hasMorePeople` opens the door, and the door — the same query with
/// only people as its kind — serves every match, newest first seeing
/// first, with no door of its own. The count follows what the pages
/// serve.
///
/// A narrowed History list serves its three most recently seen people, then the rest, and the people-only narrowing serves them all.
/// ´claim:history:a-narrowed-history-caps-its-people-at-three´
#[sqlx::test(migrations = "../../migrations")]
async fn a_narrowed_history_caps_its_people_at_three(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let kel = person(&rig.pool, "kel").await;
    let mut people = Vec::new();
    for n in 0..5 {
        people.push(person(&rig.pool, &format!("salt{n}")).await);
    }
    mark(&rig, &token, &people).await;
    let maps = post(&rig.pool, kel, 1, "Salt maps").await;
    mark(&rig, &token, &[maps]).await;
    let newest_first: Vec<Uuid> = people.iter().rev().copied().collect();

    let capped = history_query(&rig, &token, json!({ "query": "salt" })).await;
    let mut expected = newest_first[..3].to_vec();
    expected.push(maps);
    assert_eq!(ids(&capped), expected);
    assert_eq!(capped["hasMorePeople"], true);
    assert_eq!(capped["totalCount"], 4);

    let (forward, back) = walk_both_ways(&rig, &token, "salt", 1).await;
    assert_eq!(forward, expected, "the cap holds page by page");
    assert_eq!(back, expected, "and walking back");

    let door = history_query(&rig, &token, json!({ "query": "salt", "kinds": ["USER"] })).await;
    assert_eq!(ids(&door), newest_first);
    assert_eq!(door["hasMorePeople"], false);
    assert_eq!(door["totalCount"], 5);

    let content = history_query(&rig, &token, json!({ "query": "salt", "kinds": ["POST"] })).await;
    assert_eq!(ids(&content), vec![maps]);
    assert_eq!(content["hasMorePeople"], false);

    let cue = history_query(&rig, &token, json!({ "query": "@salt" })).await;
    assert_eq!(ids(&cue), newest_first[..3].to_vec());
    assert_eq!(cue["hasMorePeople"], true);
}

/// Three matching people or fewer stand whole, with no door.
///
/// A narrowed History list of three people or fewer serves them all, with no door.
/// ´claim:history:three-seen-people-need-no-door´
#[sqlx::test(migrations = "../../migrations")]
async fn three_seen_people_need_no_door(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let kel = person(&rig.pool, "kel").await;
    let mut seen = Vec::new();
    for n in 0..3 {
        seen.push(person(&rig.pool, &format!("salt{n}")).await);
    }
    seen.push(post(&rig.pool, kel, 1, "Salt maps").await);
    mark(&rig, &token, &seen).await;

    let found = history_query(&rig, &token, json!({ "query": "salt" })).await;
    assert_eq!(ids(&found).len(), 4);
    assert_eq!(found["hasMorePeople"], false);
    assert_eq!(found["totalCount"], 4);
}

/// The topics section of a narrowed list serves the three topics first
/// seen most recently among those the query matches, then the rest;
/// `hasMoreTags` opens the door, and the door — the same query with only
/// topics as its kind — serves every match, newest first seeing first,
/// with no door of its own. The count follows what the pages serve.
///
/// A narrowed History list serves its three most recently seen topics, then the rest, and the topics-only narrowing serves them all.
/// ´claim:history:a-narrowed-history-caps-its-topics-at-three´
#[sqlx::test(migrations = "../../migrations")]
async fn a_narrowed_history_caps_its_topics_at_three(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let kel = person(&rig.pool, "kel").await;
    let mut topics = Vec::new();
    for n in 0..5 {
        topics.push(tag(&rig.pool, &format!("salt{n}")).await);
    }
    mark(&rig, &token, &topics).await;
    let maps = post(&rig.pool, kel, 1, "Salt maps").await;
    mark(&rig, &token, &[maps]).await;
    let newest_first: Vec<Uuid> = topics.iter().rev().copied().collect();

    let capped = history_query(&rig, &token, json!({ "query": "salt" })).await;
    let mut expected = newest_first[..3].to_vec();
    expected.push(maps);
    assert_eq!(ids(&capped), expected);
    assert_eq!(capped["hasMoreTags"], true);
    assert_eq!(capped["hasMorePeople"], false);
    assert_eq!(capped["totalCount"], 4);

    let (forward, back) = walk_both_ways(&rig, &token, "salt", 1).await;
    assert_eq!(forward, expected, "the cap holds page by page");
    assert_eq!(back, expected, "and walking back");

    let door = history_query(
        &rig,
        &token,
        json!({ "query": "salt", "kinds": ["HASHTAG"] }),
    )
    .await;
    assert_eq!(ids(&door), newest_first);
    assert_eq!(door["hasMoreTags"], false);
    assert_eq!(door["totalCount"], 5);

    let content = history_query(&rig, &token, json!({ "query": "salt", "kinds": ["POST"] })).await;
    assert_eq!(ids(&content), vec![maps]);
    assert_eq!(content["hasMoreTags"], false);

    let cue = history_query(&rig, &token, json!({ "query": "#salt" })).await;
    assert_eq!(ids(&cue), newest_first[..3].to_vec());
    assert_eq!(cue["hasMoreTags"], true);

    let plain = history(&rig, &token, json!({ "first": 5 })).await;
    assert_eq!(plain["hasMoreTags"], false, "no query narrows nothing");
}

/// Three matching topics or fewer stand whole, with no door; a fourth
/// opens it; a query that matches no topic has none.
///
/// A narrowed History list holds its topics door shut at three topics or fewer and opens it at the fourth.
/// ´claim:history:the-topics-door-opens-at-the-fourth-topic´
#[sqlx::test(migrations = "../../migrations")]
async fn the_topics_door_opens_at_the_fourth_topic(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let kel = person(&rig.pool, "kel").await;
    let maps = post(&rig.pool, kel, 1, "Salt maps").await;
    mark(&rig, &token, &[maps]).await;

    let none = history_query(&rig, &token, json!({ "query": "salt" })).await;
    assert_eq!(ids(&none), vec![maps]);
    assert_eq!(none["hasMoreTags"], false, "no topics, no door");

    let mut topics = Vec::new();
    for n in 0..3 {
        topics.push(tag(&rig.pool, &format!("salt{n}")).await);
    }
    mark(&rig, &token, &topics).await;
    let three = history_query(&rig, &token, json!({ "query": "salt" })).await;
    assert_eq!(ids(&three).len(), 4);
    assert_eq!(three["hasMoreTags"], false, "exactly three need no door");
    assert_eq!(three["totalCount"], 4);

    let fourth = tag(&rig.pool, "salt3").await;
    mark(&rig, &token, &[fourth]).await;
    let four = history_query(&rig, &token, json!({ "query": "salt" })).await;
    assert_eq!(ids(&four).len(), 4);
    assert_eq!(four["hasMoreTags"], true, "a fourth opens the door");
    assert_eq!(four["totalCount"], 4);
}
