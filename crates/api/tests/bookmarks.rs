//! The Saved list over the wire (api-spec.md `User.bookmarks`,
//! `setBookmark`, `removeBookmark`, `viewerBookmarkedAt`; saved-surface
//! packet V1): newest first by save time, the restoring Undo, the frozen
//! keyset, the viewer-only read, the per-node state the menus read, the
//! account states that may save, and the refusals.
//!
//! The ErrorCodes each verb emits, each provoked here: UNAUTHENTICATED on
//! both verbs, NOT_FOUND for an id naming nothing, BAD_INPUT at ["node"]
//! for a topic and at ["bookmarkedAt"] for a future restore time, and
//! BAD_INPUT for a malformed cursor on the read. FORBIDDEN and
//! EMAIL_NOT_VERIFIED are deliberately never emitted (no member gate),
//! pinned by the applicant and unverified tests; no limiter guards these
//! verbs, so RATE_LIMITED is never emitted either.
//!
//! States with no verb yet are seeded by raw SQL: a hidden actor (the
//! hidden-actors packet's `hideActor`) is a raw `user_hidden_actors` row,
//! a removal is a raw tombstone version, and a deleted account reads as
//! its erasure husk — a redacted profile version — which the erasure
//! engine will write.

mod rig;

use api::ratelimit::RateLimitConfig;
use common::envelope::SensitiveMark;
use common::hashtag_uuid;
use postgres_store::content::{self, LandingOrder};
use postgres_store::{genesis, hashtag};
use rig::WireRig;
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

type Timestamp = chrono::DateTime<chrono::Utc>;

const SET: &str = r#"mutation($node: UUID!, $at: DateTime) {
  setBookmark(input: { node: $node, bookmarkedAt: $at }) {
    bookmark { cursor bookmarkedAt node { id } }
    userErrors { code field }
  }
}"#;

const REMOVE: &str = r#"mutation($node: UUID!) {
  removeBookmark(input: { node: $node }) { ok userErrors { code field } }
}"#;

const SAVED: &str = r#"query($first: Int, $after: String, $last: Int, $before: String) {
  me {
    bookmarks(first: $first, after: $after, last: $last, before: $before) {
      edges {
        cursor
        bookmarkedAt
        node {
          __typename
          id
          ... on Post { title { value status } content { value status } }
          ... on Comment { content { value status } }
          ... on User { handle displayName { value status } }
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

async fn post_with(
    pool: &PgPool,
    author: Uuid,
    secs: i64,
    title: &str,
    pending: bool,
    mark: Option<&SensitiveMark>,
) -> Uuid {
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
        mark,
    )
    .await
    .expect("post");
    tx.commit().await.expect("commit");
    id
}

async fn post(pool: &PgPool, author: Uuid, secs: i64, title: &str) -> Uuid {
    post_with(pool, author, secs, title, false, None).await
}

async fn comment(pool: &PgPool, author: Uuid, target: Uuid) -> Uuid {
    comment_on(pool, author, target, "post").await
}

async fn comment_on(pool: &PgPool, author: Uuid, target: Uuid, target_type: &str) -> Uuid {
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

async fn reader(rig: &WireRig, handle: &str) -> (Uuid, String) {
    let email = format!("{handle}@example.test");
    let (id, _) = rig.seed_member(handle, &email).await;
    (id, rig.log_in(&email).await)
}

async fn save(rig: &WireRig, token: &str, node: Uuid) -> Value {
    rig.gql(Some(token), SET, json!({ "node": node })).await["setBookmark"].clone()
}

async fn save_at(rig: &WireRig, token: &str, node: Uuid, when: &Value) -> Value {
    rig.gql(Some(token), SET, json!({ "node": node, "at": when }))
        .await["setBookmark"]
        .clone()
}

async fn unsave(rig: &WireRig, token: &str, node: Uuid) -> Value {
    rig.gql(Some(token), REMOVE, json!({ "node": node })).await["removeBookmark"].clone()
}

async fn saved(rig: &WireRig, token: &str, variables: Value) -> Value {
    rig.gql(Some(token), SAVED, variables).await["me"]["bookmarks"].clone()
}

fn ids(connection: &Value) -> Vec<Uuid> {
    connection["edges"]
        .as_array()
        .expect("edges")
        .iter()
        .map(|edge| Uuid::parse_str(edge["node"]["id"].as_str().expect("id")).expect("uuid"))
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

async fn hide(pool: &PgPool, viewer: Uuid, hidden: Uuid) {
    sqlx::query("INSERT INTO user_hidden_actors (viewer_id, hidden_id) VALUES ($1, $2)")
        .bind(viewer)
        .bind(hidden)
        .execute(pool)
        .await
        .expect("hide");
}

/// Without a session there is no Saved list to write to.
///
/// setBookmark without a session is UNAUTHENTICATED.
/// ´claim:bookmarks:set-bookmark-needs-a-session´
#[sqlx::test(migrations = "../../migrations")]
async fn set_bookmark_without_a_session_is_unauthenticated(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol").await;
    let response = rig.gql_raw(None, SET, json!({ "node": sol })).await;
    assert_eq!(first_error_code(&response), Some("UNAUTHENTICATED"));
    assert_eq!(count(&rig.pool, "user_bookmarks").await, 0);
}

/// Without a session there is no Saved list to drop from.
///
/// removeBookmark without a session is UNAUTHENTICATED.
/// ´claim:bookmarks:remove-bookmark-needs-a-session´
#[sqlx::test(migrations = "../../migrations")]
async fn remove_bookmark_without_a_session_is_unauthenticated(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol").await;
    let response = rig.gql_raw(None, REMOVE, json!({ "node": sol })).await;
    assert_eq!(first_error_code(&response), Some("UNAUTHENTICATED"));
}

/// An id a client was never served is a client bug: NOT_FOUND at the
/// transport, and nothing is written.
///
/// Saving an id that names nothing is NOT_FOUND.
/// ´claim:bookmarks:an-unknown-id-is-not-found´
#[sqlx::test(migrations = "../../migrations")]
async fn saving_an_id_that_names_nothing_is_not_found(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let response = rig
        .gql_raw(Some(&token), SET, json!({ "node": Uuid::new_v4() }))
        .await;
    assert_eq!(first_error_code(&response), Some("NOT_FOUND"));
    assert_eq!(count(&rig.pool, "user_bookmarks").await, 0);
}

/// Saved holds posts, comments and people; a topic is not saveable.
///
/// Saving a topic is BAD_INPUT at node.
/// ´claim:bookmarks:a-topic-is-not-saveable´
#[sqlx::test(migrations = "../../migrations")]
async fn saving_a_topic_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let mut conn = rig.pool.acquire().await.expect("conn");
    hashtag::upsert(&mut conn, "saltmaps").await.expect("tag");
    drop(conn);
    let refused = save(&rig, &token, hashtag_uuid("saltmaps")).await;
    assert!(refused["bookmark"].is_null());
    assert_eq!(
        refused["userErrors"],
        json!([{ "code": "BAD_INPUT", "field": ["node"] }])
    );
    assert_eq!(count(&rig.pool, "user_bookmarks").await, 0);
}

/// An Undo may pass back only a time that already passed (with a few
/// seconds of clock skew).
///
/// A restore time in the future is BAD_INPUT at bookmarkedAt.
/// ´claim:bookmarks:a-future-restore-time-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn a_restore_time_in_the_future_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let later = chrono::Utc::now() + chrono::Duration::minutes(5);
    let refused = save_at(&rig, &token, sol, &json!(later.to_rfc3339())).await;
    assert!(refused["bookmark"].is_null());
    assert_eq!(
        refused["userErrors"],
        json!([{ "code": "BAD_INPUT", "field": ["bookmarkedAt"] }])
    );
    assert_eq!(count(&rig.pool, "user_bookmarks").await, 0);
}

/// A cursor this list did not issue is a malformed argument, in either
/// direction.
///
/// A malformed Saved cursor is BAD_INPUT.
/// ´claim:bookmarks:a-malformed-cursor-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn bookmarks_with_a_malformed_cursor_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    for variables in [
        json!({ "after": "not a cursor" }),
        json!({ "last": 2, "before": "bm90IG91cnM=" }),
    ] {
        let response = rig.gql_raw(Some(&token), SAVED, variables.clone()).await;
        assert_eq!(
            first_error_code(&response),
            Some("BAD_INPUT"),
            "for {variables}"
        );
    }
}

/// Another account's Saved list is null, field-level — never an error,
/// never their rows; so is the list without a session.
///
/// The Saved list is viewer-only.
/// ´claim:bookmarks:viewer-only´
#[sqlx::test(migrations = "../../migrations")]
async fn bookmarks_are_viewer_only(pool: PgPool) {
    let rig = rig(pool);
    let (_, owner) = reader(&rig, "owner").await;
    let (_, other) = reader(&rig, "other").await;
    let sol = person(&rig.pool, "sol").await;
    save(&rig, &owner, sol).await;

    let query = r#"query { user(handle: "owner") { handle bookmarks { totalCount } } }"#;
    let as_other = rig.gql_raw(Some(&other), query, json!({})).await;
    assert!(as_other["errors"].is_null(), "{as_other}");
    assert_eq!(as_other["data"]["user"]["handle"], "owner");
    assert!(as_other["data"]["user"]["bookmarks"].is_null());
    let anonymous = rig.gql_raw(None, query, json!({})).await;
    assert!(anonymous["data"]["user"]["bookmarks"].is_null());
    let as_owner = rig.gql_raw(Some(&owner), query, json!({})).await;
    assert_eq!(as_owner["data"]["user"]["bookmarks"]["totalCount"], 1);
}

/// Each saveable kind answers when the viewer kept it, and null when not
/// — the state every menu's Save / Unsave row reads.
///
/// viewerBookmarkedAt reads per post, comment and person.
/// ´claim:bookmarks:viewer-bookmarked-at-reads-per-node´
#[sqlx::test(migrations = "../../migrations")]
async fn viewer_bookmarked_at_reads_per_post_comment_and_user(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let p = post(&rig.pool, sol, 1, "P").await;
    let q = post(&rig.pool, sol, 2, "Q").await;
    let c = comment(&rig.pool, sol, p).await;
    let query = r#"query($p: UUID!, $q: UUID!, $c: UUID!) {
      p: post(id: $p) { viewerBookmarkedAt }
      q: post(id: $q) { viewerBookmarkedAt }
      c: comment(id: $c) { viewerBookmarkedAt }
      u: user(handle: "sol") { viewerBookmarkedAt }
    }"#;
    let vars = json!({ "p": p, "q": q, "c": c });

    let before = rig.gql(Some(&token), query, vars.clone()).await;
    for key in ["p", "q", "c", "u"] {
        assert!(before[key]["viewerBookmarkedAt"].is_null(), "{key}");
    }
    let kept_p = save(&rig, &token, p).await["bookmark"]["bookmarkedAt"].clone();
    let kept_c = save(&rig, &token, c).await["bookmark"]["bookmarkedAt"].clone();
    let kept_u = save(&rig, &token, sol).await["bookmark"]["bookmarkedAt"].clone();

    let after = rig.gql(Some(&token), query, vars).await;
    assert_eq!(after["p"]["viewerBookmarkedAt"], kept_p);
    assert!(after["q"]["viewerBookmarkedAt"].is_null());
    assert_eq!(after["c"]["viewerBookmarkedAt"], kept_c);
    assert_eq!(after["u"]["viewerBookmarkedAt"], kept_u);
}

/// With no session nothing is kept, and the field is null, not an error.
///
/// viewerBookmarkedAt is null signed out.
/// ´claim:bookmarks:viewer-bookmarked-at-is-null-signed-out´
#[sqlx::test(migrations = "../../migrations")]
async fn viewer_bookmarked_at_is_null_signed_out(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let p = post(&rig.pool, sol, 1, "P").await;
    save(&rig, &token, p).await;
    let response = rig
        .gql_raw(
            None,
            r#"query($p: UUID!) { post(id: $p) { viewerBookmarkedAt } }"#,
            json!({ "p": p }),
        )
        .await;
    assert!(response["errors"].is_null(), "{response}");
    assert!(response["data"]["post"]["viewerBookmarkedAt"].is_null());
}

/// Saving is private viewer state, not acting: an applicant saves and
/// reads like a member, and is never refused FORBIDDEN.
///
/// An applicant saves and reads Saved.
/// ´claim:bookmarks:applicants-save´
#[sqlx::test(migrations = "../../migrations")]
async fn an_applicant_saves_and_reads_saved(pool: PgPool) {
    let rig = rig(pool);
    let (me, token) = reader(&rig, "applicant").await;
    sqlx::query("UPDATE user_credentials SET account_state = 'applicant' WHERE actor_id = $1")
        .bind(me)
        .execute(&rig.pool)
        .await
        .expect("applicant");
    let sol = person(&rig.pool, "sol").await;
    let p = post(&rig.pool, sol, 1, "P").await;

    let response = rig.gql_raw(Some(&token), SET, json!({ "node": p })).await;
    assert!(response["errors"].is_null(), "{response}");
    assert_eq!(saved(&rig, &token, json!({})).await["totalCount"], 1);
    assert_eq!(unsave(&rig, &token, p).await["ok"], true);
}

/// The email proof gates acting, not keeping: an unverified account
/// saves, and is never refused EMAIL_NOT_VERIFIED.
///
/// An unverified account saves.
/// ´claim:bookmarks:unverified-accounts-save´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unverified_account_saves(pool: PgPool) {
    let rig = rig(pool);
    let (me, token) = reader(&rig, "fresh").await;
    sqlx::query("UPDATE user_credentials SET email_verified_at = NULL WHERE actor_id = $1")
        .bind(me)
        .execute(&rig.pool)
        .await
        .expect("unverified");
    let sol = person(&rig.pool, "sol").await;
    let response = rig.gql_raw(Some(&token), SET, json!({ "node": sol })).await;
    assert!(response["errors"].is_null(), "{response}");
    assert_eq!(ids(&saved(&rig, &token, json!({})).await), vec![sol]);
}

/// A repeated save answers the same edge and changes nothing — what
/// makes a client's retry and a second device safe.
///
/// setBookmark twice returns the same edge.
/// ´claim:bookmarks:set-bookmark-is-idempotent´
#[sqlx::test(migrations = "../../migrations")]
async fn set_bookmark_twice_returns_the_same_edge(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let first = save(&rig, &token, sol).await;
    let second = save(&rig, &token, sol).await;
    assert_eq!(first["userErrors"], json!([]));
    assert_eq!(second["bookmark"], first["bookmark"]);
    assert_eq!(count(&rig.pool, "user_bookmarks").await, 1);
}

/// Dropping a node twice, or one never kept, is ok.
///
/// removeBookmark twice is ok.
/// ´claim:bookmarks:remove-bookmark-is-idempotent´
#[sqlx::test(migrations = "../../migrations")]
async fn remove_bookmark_twice_is_ok(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    save(&rig, &token, sol).await;
    for _ in 0..2 {
        let removed = unsave(&rig, &token, sol).await;
        assert_eq!(removed["ok"], true);
        assert_eq!(removed["userErrors"], json!([]));
    }
    assert_eq!(count(&rig.pool, "user_bookmarks").await, 0);
}

/// The flow unsave-and-undo: the client passes the removed edge's own
/// time back, and the row returns between the same neighbours, with the
/// same cursor.
///
/// Undo puts the row back where it was.
/// ´claim:bookmarks:undo-restores-the-place´
#[sqlx::test(migrations = "../../migrations")]
async fn undo_puts_the_row_back_where_it_was(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let a = post(&rig.pool, sol, 1, "A").await;
    let b = post(&rig.pool, sol, 2, "B").await;
    let c = post(&rig.pool, sol, 3, "C").await;
    for (n, id) in [a, b, c].into_iter().enumerate() {
        let when = chrono::Utc::now() - chrono::Duration::hours(3 - n as i64);
        save_at(&rig, &token, id, &json!(when.to_rfc3339())).await;
    }
    let before = saved(&rig, &token, json!({})).await;
    assert_eq!(ids(&before), vec![c, b, a]);
    let removed_edge = before["edges"][1].clone();

    unsave(&rig, &token, b).await;
    assert_eq!(ids(&saved(&rig, &token, json!({})).await), vec![c, a]);
    let restored = save_at(&rig, &token, b, &removed_edge["bookmarkedAt"]).await;
    assert_eq!(restored["bookmark"]["cursor"], removed_edge["cursor"]);

    let after = saved(&rig, &token, json!({})).await;
    assert_eq!(ids(&after), vec![c, b, a]);
    assert_eq!(
        after["edges"][1]["bookmarkedAt"],
        removed_edge["bookmarkedAt"]
    );
}

/// Paging is keyset on (bookmarkedAt, node id): a save made while the
/// reader pages sorts above the open page, so the next page is exactly
/// the rest; it joins at the next open.
///
/// A save made mid-scroll never shifts the next page.
/// ´claim:bookmarks:frozen-paging´
#[sqlx::test(migrations = "../../migrations")]
async fn a_save_made_mid_scroll_never_shifts_the_next_page(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let mut kept = Vec::new();
    for n in 0..5 {
        let p = post(&rig.pool, sol, n, &format!("Post {n}")).await;
        save(&rig, &token, p).await;
        kept.push(p);
    }
    let fresh = post(&rig.pool, sol, 9, "Fresh").await;

    let first = saved(&rig, &token, json!({ "first": 2 })).await;
    assert_eq!(ids(&first), vec![kept[4], kept[3]]);
    assert_eq!(first["pageInfo"]["hasNextPage"], true);
    save(&rig, &token, fresh).await;
    let second = saved(
        &rig,
        &token,
        json!({ "first": 2, "after": first["pageInfo"]["endCursor"] }),
    )
    .await;
    assert_eq!(ids(&second), vec![kept[2], kept[1]]);
    assert_eq!(second["pageInfo"]["hasPreviousPage"], true);

    let back = saved(
        &rig,
        &token,
        json!({ "last": 2, "before": second["pageInfo"]["startCursor"] }),
    )
    .await;
    assert_eq!(ids(&back), vec![kept[4], kept[3]]);

    let reopened = saved(&rig, &token, json!({ "first": 1 })).await;
    assert_eq!(ids(&reopened), vec![fresh]);
}

/// Unsaving the row a page ended on never skips the row after it: the
/// keyset position survives its own row's delete.
///
/// An unsave mid-scroll never skips the next row.
/// ´claim:bookmarks:an-unsave-mid-scroll-skips-nothing´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unsave_mid_scroll_never_skips_the_next_row(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let mut kept = Vec::new();
    for n in 0..4 {
        let p = post(&rig.pool, sol, n, &format!("Post {n}")).await;
        save(&rig, &token, p).await;
        kept.push(p);
    }
    let first = saved(&rig, &token, json!({ "first": 2 })).await;
    assert_eq!(ids(&first), vec![kept[3], kept[2]]);
    unsave(&rig, &token, kept[2]).await;
    let second = saved(
        &rig,
        &token,
        json!({ "first": 2, "after": first["pageInfo"]["endCursor"] }),
    )
    .await;
    assert_eq!(ids(&second), vec![kept[1], kept[0]]);
}

/// A pending post that is discarded before it lands is skipped on read,
/// never an error.
///
/// A discarded pending save is skipped.
/// ´claim:bookmarks:a-discarded-pending-node-is-skipped´
#[sqlx::test(migrations = "../../migrations")]
async fn a_discarded_pending_save_is_skipped_not_an_error(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let kept = post(&rig.pool, sol, 1, "Kept").await;
    let pending = post_with(&rig.pool, sol, 2, "Pending", true, None).await;
    save(&rig, &token, kept).await;
    save(&rig, &token, pending).await;

    let mut tx = rig.pool.begin().await.expect("tx");
    content::discard_pending(&mut tx, pending, at(2))
        .await
        .expect("discard");
    tx.commit().await.expect("commit");

    let page = saved(&rig, &token, json!({})).await;
    assert_eq!(ids(&page), vec![kept]);
    assert_eq!(page["totalCount"], 1);
}

/// A post still settling resolves through its registry row like any
/// other, so it can be kept.
///
/// A still-settling post can be saved.
/// ´claim:bookmarks:a-pending-post-is-saveable´
#[sqlx::test(migrations = "../../migrations")]
async fn a_still_settling_post_can_be_saved(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let pending = post_with(&rig.pool, sol, 2, "Pending", true, None).await;
    let kept = save(&rig, &token, pending).await;
    assert_eq!(kept["userErrors"], json!([]));
    assert_eq!(ids(&saved(&rig, &token, json!({})).await), vec![pending]);
}

/// The reader's own things carry the Save row too (readme:4807-4812).
///
/// The reader saves their own post and comment.
/// ´claim:bookmarks:own-things-are-saveable´
#[sqlx::test(migrations = "../../migrations")]
async fn the_reader_saves_their_own_post_and_comment(pool: PgPool) {
    let rig = rig(pool);
    let (me, token) = reader(&rig, "reader").await;
    let mine = post(&rig.pool, me, 1, "Mine").await;
    let my_comment = comment(&rig.pool, me, mine).await;
    save(&rig, &token, mine).await;
    save(&rig, &token, my_comment).await;
    let page = saved(&rig, &token, json!({})).await;
    assert_eq!(ids(&page).len(), 2);
    assert!(ids(&page).contains(&mine) && ids(&page).contains(&my_comment));
}

/// Saving stays in the app: no staged write, no record.
///
/// Saving never becomes a graph record.
/// ´claim:bookmarks:saving-is-never-a-graph-record´
#[sqlx::test(migrations = "../../migrations")]
async fn saving_writes_no_staged_write_and_no_record(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let p = post(&rig.pool, sol, 1, "P").await;
    let (staged, records, legs) = (
        count(&rig.pool, "staged_writes").await,
        count(&rig.pool, "mirror_records").await,
        count(&rig.pool, "mirror_record_legs").await,
    );
    save(&rig, &token, p).await;
    save(&rig, &token, sol).await;
    unsave(&rig, &token, sol).await;
    rig.close_and_ingest().await;
    assert_eq!(count(&rig.pool, "staged_writes").await, staged);
    assert_eq!(count(&rig.pool, "mirror_records").await, records);
    assert_eq!(count(&rig.pool, "mirror_record_legs").await, legs);
    assert_eq!(count(&rig.pool, "user_bookmarks").await, 1);
}

/// A removed post keeps its place and reads its removal mark — never
/// erased silently (SG-4 (a), item 49).
///
/// A removed kept post stays and reads its removal.
/// ´claim:bookmarks:a-removed-kept-post-stays´
#[sqlx::test(migrations = "../../migrations")]
async fn a_removed_kept_post_stays_and_reads_its_removal(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let removed = post(&rig.pool, sol, 1, "Removed").await;
    save(&rig, &token, removed).await;
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

    let page = saved(&rig, &token, json!({})).await;
    assert_eq!(ids(&page), vec![removed]);
    assert_eq!(page["edges"][0]["node"]["title"]["status"], "REDACTED");
}

/// A redacted comment keeps its place and reads its mark.
///
/// A redacted kept comment stays.
/// ´claim:bookmarks:a-redacted-kept-comment-stays´
#[sqlx::test(migrations = "../../migrations")]
async fn a_redacted_kept_comment_stays(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let p = post(&rig.pool, sol, 1, "P").await;
    let c = comment(&rig.pool, sol, p).await;
    save(&rig, &token, c).await;
    sqlx::query(
        "INSERT INTO comment_versions
             (comment_id, content, redaction_reason, pending, created_at,
              landed_epoch, act_time, position)
         VALUES ($1, '[removed]', 'policy', FALSE, $2, 9, 9, 0)",
    )
    .bind(c)
    .bind(at(9))
    .execute(&rig.pool)
    .await
    .expect("tombstone");

    let page = saved(&rig, &token, json!({})).await;
    assert_eq!(ids(&page), vec![c]);
    assert_eq!(page["edges"][0]["node"]["content"]["status"], "REDACTED");
}

/// A deleted account stays kept and reads as its husk: the name is gone
/// and the mark stays (ER-G10: null value, REDACTED status).
///
/// A kept deleted account stays as a husk.
/// ´claim:bookmarks:a-kept-deleted-account-stays´
#[sqlx::test(migrations = "../../migrations")]
async fn a_kept_deleted_account_stays_as_a_husk(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    save(&rig, &token, sol).await;
    sqlx::query(
        "INSERT INTO actor_profile_versions
             (actor_id, display_name, redaction_reason, landed_epoch, act_time, position)
         VALUES ($1, '[redacted]', 'erasure', 99, 99, 0)",
    )
    .bind(sol)
    .execute(&rig.pool)
    .await
    .expect("husk");

    let page = saved(&rig, &token, json!({})).await;
    assert_eq!(ids(&page), vec![sol]);
    assert_eq!(page["edges"][0]["node"]["__typename"], "User");
    assert_eq!(
        page["edges"][0]["node"]["displayName"]["status"],
        "REDACTED"
    );
}

/// A sensitive post stays, its status readable on the row.
///
/// A kept sensitive post stays with its status.
/// ´claim:bookmarks:a-kept-sensitive-post-stays´
#[sqlx::test(migrations = "../../migrations")]
async fn a_kept_sensitive_post_stays_with_its_status(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let mark = SensitiveMark {
        reason: Some("spoilers".into()),
    };
    let p = post_with(&rig.pool, sol, 1, "Veiled", false, Some(&mark)).await;
    save(&rig, &token, p).await;

    let page = saved(&rig, &token, json!({})).await;
    assert_eq!(ids(&page), vec![p]);
    assert_eq!(page["edges"][0]["node"]["content"]["status"], "SENSITIVE");
}

/// A comment row names and opens the post its thread hangs under: the
/// target for a top-level comment, the thread's post for a reply however
/// deep — read in one field, never by walking `target` (F2).
///
/// A comment's post is its thread's post at any depth.
/// ´claim:bookmarks:a-comments-post-is-its-threads-post´
#[sqlx::test(migrations = "../../migrations")]
async fn a_replys_post_is_the_threads_post(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let p = post(&rig.pool, sol, 1, "The long way home").await;
    let top = comment(&rig.pool, sol, p).await;
    let reply = comment_on(&rig.pool, sol, top, "comment").await;
    let deep = comment_on(&rig.pool, sol, reply, "comment").await;
    for c in [top, deep] {
        save(&rig, &token, c).await;
    }
    let query = r#"{ me { bookmarks { edges { node {
        id ... on Comment { post { id title { value } } } } } } } }"#;
    let page = rig.gql(Some(&token), query, json!({})).await;
    let edges = page["me"]["bookmarks"]["edges"].as_array().expect("edges");
    assert_eq!(edges.len(), 2);
    for edge in edges {
        assert_eq!(edge["node"]["post"]["id"], json!(p), "{edge}");
        assert_eq!(edge["node"]["post"]["title"]["value"], "The long way home");
    }
}

/// Hiding is for the feed: a hidden actor's things and their profile stay
/// in Saved (SG-4 (d), item 49 + PR-11).
///
/// A hidden actor's kept things stay in Saved.
/// ´claim:bookmarks:hiding-never-narrows-saved´
#[sqlx::test(migrations = "../../migrations")]
async fn a_hidden_actors_kept_things_stay_in_saved(pool: PgPool) {
    let rig = rig(pool);
    let (me, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let p = post(&rig.pool, sol, 1, "P").await;
    let c = comment(&rig.pool, sol, p).await;
    for id in [p, c, sol] {
        save(&rig, &token, id).await;
    }
    hide(&rig.pool, me, sol).await;
    let page = saved(&rig, &token, json!({})).await;
    assert_eq!(ids(&page), vec![sol, c, p]);
    assert_eq!(page["totalCount"], 3);
}

const SAVED_QUERY: &str = r#"query($query: String, $kinds: [NodeKind!], $first: Int,
                                  $after: String, $last: Int, $before: String) {
  me {
    bookmarks(query: $query, kinds: $kinds, first: $first, after: $after,
              last: $last, before: $before) {
      edges { cursor node { __typename id } }
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      totalCount
      hasMorePeople
    }
  }
}"#;

async fn saved_query_raw(rig: &WireRig, token: &str, variables: Value) -> Value {
    rig.gql_raw(Some(token), SAVED_QUERY, variables).await
}

async fn saved_query(rig: &WireRig, token: &str, variables: Value) -> Value {
    let response = saved_query_raw(rig, token, variables.clone()).await;
    assert!(response.get("errors").is_none(), "{variables}: {response}");
    response["data"]["me"]["bookmarks"].clone()
}

/// The narrowing runs on the server over the whole saved set: a match
/// saved long before the first page reaches is found on the first page,
/// counted alone, and a match the reader never saved is not.
///
/// A Saved query finds a match wherever it stands in the list, never only within the loaded window.
/// ´claim:bookmarks:a-saved-query-runs-over-the-whole-list´
#[sqlx::test(migrations = "../../migrations")]
async fn a_saved_query_finds_a_match_beyond_the_loaded_window(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let kel = person(&rig.pool, "kel").await;
    let old = post(&rig.pool, kel, 0, "Salt maps of the coast road").await;
    save(&rig, &token, old).await;
    for n in 1..=30 {
        let p = post(&rig.pool, kel, n, &format!("Rubbing {n}")).await;
        save(&rig, &token, p).await;
    }
    post(&rig.pool, kel, 40, "Salt flats").await;

    let window = saved(&rig, &token, json!({ "first": 5 })).await;
    assert!(!ids(&window).contains(&old), "beyond the plain first page");
    let found = saved_query(&rig, &token, json!({ "query": "salt", "first": 5 })).await;
    assert_eq!(ids(&found), vec![old]);
    assert_eq!(found["totalCount"], 1);
    assert_eq!(found["pageInfo"]["hasNextPage"], false);
    for blank in [json!(null), json!(""), json!("   ")] {
        let plain = saved_query(&rig, &token, json!({ "query": blank, "first": 5 })).await;
        assert_eq!(ids(&plain), ids(&window), "a blank query narrows nothing");
        assert_eq!(plain["totalCount"], 31);
    }
}

/// Saved runs the one search law over the saved set: a narrowed list is
/// sectioned — people, then content — newest save first inside each. A
/// person cue lists the saved profiles it names, then the saved things
/// they authored; plain text reaches a person's saved posts through
/// their display name. A topic is never saved, so a topic cue lists only
/// saved content.
///
/// A narrowed Saved list follows the search law: people first, then content, newest save first.
/// ´claim:bookmarks:a-narrowed-saved-list-follows-the-search-law´
#[sqlx::test(migrations = "../../migrations")]
async fn a_narrowed_saved_list_follows_the_search_law(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let solarium = person(&rig.pool, "solarium").await;
    let kel = person(&rig.pool, "kel").await;
    let theirs = post(&rig.pool, solarium, 1, "Rubbings").await;
    let their_comment = comment(&rig.pool, solarium, theirs).await;
    let unsaved = post(&rig.pool, solarium, 2, "Wax charts").await;
    let kels = post(&rig.pool, kel, 3, "Solar charts").await;
    for id in [theirs, solarium, their_comment, kels] {
        save(&rig, &token, id).await;
    }

    let cue = saved_query(&rig, &token, json!({ "query": "@sol" })).await;
    assert_eq!(ids(&cue), vec![solarium, their_comment, theirs]);
    assert!(!ids(&cue).contains(&unsaved));
    assert_eq!(cue["totalCount"], 3);
    let text = saved_query(&rig, &token, json!({ "query": "sol" })).await;
    assert_eq!(
        ids(&text),
        vec![solarium, kels, theirs],
        "the handle and display name, then the title match and the display-name author's post"
    );
    let topics = saved_query(&rig, &token, json!({ "query": "#sol" })).await;
    assert_eq!(ids(&topics), Vec::<Uuid>::new());
    assert_eq!(topics["totalCount"], 0);
}

/// A narrowed list pages on its own keyset: every page forward and every
/// page backward yields the one-shot order, sections included. Its
/// cursors and the plain list's never pass for each other, and a query
/// past the search cap is refused.
///
/// A narrowed Saved list pages stably both ways, on cursors of its own.
/// ´claim:bookmarks:a-narrowed-list-pages-on-its-own-keyset´
#[sqlx::test(migrations = "../../migrations")]
async fn a_narrowed_saved_list_pages_on_its_own_keyset(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let salter = person(&rig.pool, "salter").await;
    let kel = person(&rig.pool, "kel").await;
    for n in 0..7 {
        let p = post(&rig.pool, kel, n, &format!("Salt study {n}")).await;
        save(&rig, &token, p).await;
        if n == 3 {
            save(&rig, &token, salter).await;
        }
    }
    let whole = saved_query(&rig, &token, json!({ "query": "salt", "first": 100 })).await;
    let expected = ids(&whole);
    assert_eq!(expected.len(), 8);
    assert_eq!(expected[0], salter, "the people section leads");

    let mut walked = Vec::new();
    let mut after = Value::Null;
    loop {
        let page = saved_query(
            &rig,
            &token,
            json!({ "query": "salt", "first": 3, "after": after }),
        )
        .await;
        walked.extend(ids(&page));
        if page["pageInfo"]["hasNextPage"] != true {
            break;
        }
        after = page["pageInfo"]["endCursor"].clone();
    }
    assert_eq!(walked, expected, "forward");
    let mut back = Vec::new();
    let mut before = Value::Null;
    loop {
        let page = saved_query(
            &rig,
            &token,
            json!({ "query": "salt", "last": 3, "before": before }),
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
    assert_eq!(back, expected, "backward");

    let narrowed_cursor = whole["edges"][0]["cursor"].clone();
    let plain = saved(&rig, &token, json!({ "first": 1 })).await;
    let plain_cursor = plain["edges"][0]["cursor"].clone();
    for variables in [
        json!({ "query": "salt", "after": plain_cursor }),
        json!({ "after": narrowed_cursor }),
        json!({ "query": "s".repeat(api::search::MAX_QUERY_CHARS + 1) }),
    ] {
        let refused = saved_query_raw(&rig, &token, variables.clone()).await;
        assert_eq!(first_error_code(&refused), Some("BAD_INPUT"), "{variables}");
    }
}

/// A save time in the past, `secs` apart: a restore may carry it, so the
/// list's order is the test's to choose.
fn saved_at(secs: i64) -> Value {
    json!(
        chrono::DateTime::from_timestamp(1_760_000_000 + secs, 0)
            .expect("in range")
            .to_rfc3339()
    )
}

/// The people section of a narrowed list serves the three newest saves
/// among the people the query matches, then the content; `hasMorePeople`
/// opens the door, and the door — the same query with only people as its
/// kind — serves every match, newest save first, with no door of its own.
/// The count follows what the pages serve.
///
/// A narrowed Saved list serves its three newest saved people, then content, and the people-only narrowing serves them all.
/// ´claim:bookmarks:a-narrowed-saved-list-caps-its-people-at-three´
#[sqlx::test(migrations = "../../migrations")]
async fn a_narrowed_saved_list_caps_its_people_at_three(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let kel = person(&rig.pool, "kel").await;
    let mut people = Vec::new();
    for n in 0..5 {
        let p = person(&rig.pool, &format!("salt{n}")).await;
        save_at(&rig, &token, p, &saved_at(n)).await;
        people.push(p);
    }
    let maps = post(&rig.pool, kel, 1, "Salt maps").await;
    save_at(&rig, &token, maps, &saved_at(10)).await;
    let newest_first: Vec<Uuid> = people.iter().rev().copied().collect();

    let capped = saved_query(&rig, &token, json!({ "query": "salt" })).await;
    let mut expected = newest_first[..3].to_vec();
    expected.push(maps);
    assert_eq!(ids(&capped), expected);
    assert_eq!(capped["hasMorePeople"], true);
    assert_eq!(capped["totalCount"], 4);

    let mut walked = Vec::new();
    let mut after = Value::Null;
    loop {
        let page = saved_query(
            &rig,
            &token,
            json!({ "query": "salt", "first": 1, "after": after }),
        )
        .await;
        walked.extend(ids(&page));
        if page["pageInfo"]["hasNextPage"] != true {
            break;
        }
        after = page["pageInfo"]["endCursor"].clone();
    }
    assert_eq!(walked, expected, "the cap holds page by page");
    let mut back = Vec::new();
    let mut before = Value::Null;
    loop {
        let page = saved_query(
            &rig,
            &token,
            json!({ "query": "salt", "last": 1, "before": before }),
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
    assert_eq!(back, expected, "and walking back");

    let door = saved_query(&rig, &token, json!({ "query": "salt", "kinds": ["USER"] })).await;
    assert_eq!(ids(&door), newest_first);
    assert_eq!(door["hasMorePeople"], false);
    assert_eq!(door["totalCount"], 5);

    let content = saved_query(&rig, &token, json!({ "query": "salt", "kinds": ["POST"] })).await;
    assert_eq!(ids(&content), vec![maps]);
    assert_eq!(content["hasMorePeople"], false);

    let cue = saved_query(&rig, &token, json!({ "query": "@salt" })).await;
    assert_eq!(ids(&cue), newest_first[..3].to_vec());
    assert_eq!(cue["hasMorePeople"], true);
}

/// Three saved people or fewer stand whole, with no door.
///
/// A narrowed Saved list of three people or fewer serves them all, with no door.
/// ´claim:bookmarks:three-saved-people-need-no-door´
#[sqlx::test(migrations = "../../migrations")]
async fn three_saved_people_need_no_door(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let kel = person(&rig.pool, "kel").await;
    for n in 0..3 {
        let p = person(&rig.pool, &format!("salt{n}")).await;
        save_at(&rig, &token, p, &saved_at(n)).await;
    }
    let maps = post(&rig.pool, kel, 1, "Salt maps").await;
    save(&rig, &token, maps).await;

    let found = saved_query(&rig, &token, json!({ "query": "salt" })).await;
    assert_eq!(ids(&found).len(), 4);
    assert_eq!(found["hasMorePeople"], false);
    assert_eq!(found["totalCount"], 4);
}

/// `kinds` narrows the whole list too, with no query: only the kinds
/// named stand, and the count follows. A kind Saved never holds is a
/// malformed argument; an empty list narrows nothing.
///
/// Saved's kinds narrow the list with or without a query, and a kind Saved never holds is BAD_INPUT.
/// ´claim:bookmarks:kinds-narrow-the-saved-list´
#[sqlx::test(migrations = "../../migrations")]
async fn kinds_narrow_the_saved_list(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let p = post(&rig.pool, sol, 1, "Rubbings").await;
    let c = comment(&rig.pool, sol, p).await;
    for id in [sol, p, c] {
        save(&rig, &token, id).await;
    }

    let people = saved_query(&rig, &token, json!({ "kinds": ["USER"] })).await;
    assert_eq!(ids(&people), vec![sol]);
    assert_eq!(people["totalCount"], 1);
    assert_eq!(people["hasMorePeople"], false);
    let content = saved_query(&rig, &token, json!({ "kinds": ["COMMENT", "POST"] })).await;
    assert_eq!(ids(&content), vec![c, p]);
    assert_eq!(content["totalCount"], 2);
    let every = saved_query(&rig, &token, json!({ "kinds": [] })).await;
    assert_eq!(every["totalCount"], 3);

    let refused = saved_query_raw(&rig, &token, json!({ "kinds": ["HASHTAG"] })).await;
    assert_eq!(first_error_code(&refused), Some("BAD_INPUT"));
}
