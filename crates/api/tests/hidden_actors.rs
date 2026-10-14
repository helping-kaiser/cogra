//! The hidden-actors list over the wire (api-spec.md `User.hiddenActors`,
//! `hideActor`, `unhideActor`; hidden-actors-surface packet HB): most
//! recently hidden first, the once-per-actor law, the Undo restore, the
//! frozen keyset, the viewer-only read, the account states that may hide,
//! the cascade the reaper needs, and the refusals.
//!
//! The ErrorCodes each verb emits, each provoked here: UNAUTHENTICATED on
//! both verbs; NOT_FOUND for an id naming no actor; BAD_INPUT for the
//! viewer's own id, for a restore moment after now, and for a page past the
//! cap — all at the transport, client bugs no drawn surface renders.
//! FORBIDDEN and EMAIL_NOT_VERIFIED are never emitted (no acting gate),
//! pinned by the applicant tests; no limiter guards these verbs.
//!
//! A deleted member's account is seeded as its erasure husk — a redacted
//! profile version — which the erasure engine will write.

mod rig;

use api::ratelimit::RateLimitConfig;
use chrono::{Duration, Utc};
use postgres_store::genesis;
use rig::WireRig;
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

const HIDE: &str = r#"mutation($actor: UUID!, $at: DateTime) {
  hideActor(input: { actor: $actor, hiddenAt: $at }) {
    hidden { cursor hiddenAt node { id handle } }
    userErrors { code field }
  }
}"#;

const UNHIDE: &str = r#"mutation($actor: UUID!) {
  unhideActor(input: { actor: $actor }) { ok userErrors { code field } }
}"#;

const HIDDEN: &str = r#"query($first: Int, $after: String, $last: Int, $before: String) {
  me {
    hiddenActors(first: $first, after: $after, last: $last, before: $before) {
      edges { cursor hiddenAt node { id handle displayName { value status } } }
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      totalCount
    }
  }
}"#;

fn rig(pool: PgPool) -> WireRig {
    WireRig::new(pool, RateLimitConfig::unlimited())
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

async fn reader(rig: &WireRig, handle: &str) -> (Uuid, String) {
    let email = format!("{handle}@example.test");
    let (id, _) = rig.seed_member(handle, &email).await;
    (id, rig.log_in(&email).await)
}

async fn hide(rig: &WireRig, token: &str, actor: Uuid) -> Value {
    rig.gql(Some(token), HIDE, json!({ "actor": actor })).await["hideActor"].clone()
}

async fn hide_at(rig: &WireRig, token: &str, actor: Uuid, at: &Value) -> Value {
    rig.gql(Some(token), HIDE, json!({ "actor": actor, "at": at }))
        .await["hideActor"]
        .clone()
}

async fn unhide(rig: &WireRig, token: &str, actor: Uuid) -> Value {
    rig.gql(Some(token), UNHIDE, json!({ "actor": actor }))
        .await["unhideActor"]
        .clone()
}

async fn hidden(rig: &WireRig, token: &str, variables: Value) -> Value {
    rig.gql(Some(token), HIDDEN, variables).await["me"]["hiddenActors"].clone()
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

/// Later hides stand above earlier ones, each with its moment.
///
/// The hidden list reads most recently hidden first.
/// ´claim:hidden:most-recently-hidden-first´
#[sqlx::test(migrations = "../../migrations")]
async fn hidden_actors_read_most_recently_hidden_first(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let ada = person(&rig.pool, "ada").await;
    let sol = person(&rig.pool, "sol").await;
    hide(&rig, &token, ada).await;
    hide(&rig, &token, sol).await;
    let page = hidden(&rig, &token, json!({})).await;
    assert_eq!(ids(&page), vec![sol, ada]);
    assert!(page["edges"][0]["hiddenAt"].is_string());
}

/// Hiding a hidden actor keeps its edge and its first moment.
///
/// A second hide keeps the first moment.
/// ´claim:hidden:a-second-hide-keeps-the-first-moment´
#[sqlx::test(migrations = "../../migrations")]
async fn hiding_twice_keeps_the_first_moment(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let ada = person(&rig.pool, "ada").await;
    let first = hide(&rig, &token, ada).await;
    let second = hide(&rig, &token, ada).await;
    assert_eq!(second["hidden"], first["hidden"]);
    assert_eq!(count(&rig.pool, "user_hidden_actors").await, 1);
}

/// An unhide deletes the row outright.
///
/// Unhiding removes the row.
/// ´claim:hidden:unhide-removes-the-row´
#[sqlx::test(migrations = "../../migrations")]
async fn unhide_removes_the_row(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let ada = person(&rig.pool, "ada").await;
    hide(&rig, &token, ada).await;
    assert_eq!(unhide(&rig, &token, ada).await["ok"], true);
    assert_eq!(count(&rig.pool, "user_hidden_actors").await, 0);
    assert_eq!(hidden(&rig, &token, json!({})).await["totalCount"], 0);
}

/// Unhiding an actor not hidden is ok and touches nothing.
///
/// Unhiding an actor not hidden is ok.
/// ´claim:hidden:unhiding-an-unhidden-actor-is-ok´
#[sqlx::test(migrations = "../../migrations")]
async fn unhiding_an_actor_not_hidden_is_ok(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let ada = person(&rig.pool, "ada").await;
    let answer = unhide(&rig, &token, ada).await;
    assert_eq!(answer["ok"], true);
    assert_eq!(answer["userErrors"], json!([]));
}

/// The Undo of an unhide passes the row's own moment back, and the row
/// returns between the same neighbours with the same age.
///
/// A restored hide returns to its old place.
/// ´claim:hidden:a-restored-hide-returns-to-its-place´
#[sqlx::test(migrations = "../../migrations")]
async fn a_restored_hide_returns_to_its_old_place(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let a = person(&rig.pool, "anna").await;
    let b = person(&rig.pool, "bert").await;
    let c = person(&rig.pool, "cleo").await;
    for (n, id) in [a, b, c].into_iter().enumerate() {
        let when = Utc::now() - Duration::hours(3 - n as i64);
        hide_at(&rig, &token, id, &json!(when.to_rfc3339())).await;
    }
    let before = hidden(&rig, &token, json!({})).await;
    assert_eq!(ids(&before), vec![c, b, a]);
    let edge = before["edges"][1].clone();
    unhide(&rig, &token, b).await;
    let restored = hide_at(&rig, &token, b, &edge["hiddenAt"]).await;
    assert_eq!(restored["hidden"]["cursor"], edge["cursor"]);
    let after = hidden(&rig, &token, json!({})).await;
    assert_eq!(ids(&after), vec![c, b, a]);
    assert_eq!(after["edges"][1]["hiddenAt"], edge["hiddenAt"]);
}

/// Paging is keyset on (hiddenAt, actor id): a hide landing while the reader
/// pages sorts above the open page, so the next page is exactly the rest.
///
/// The hidden list pages without skips while hides land.
/// ´claim:hidden:frozen-paging´
#[sqlx::test(migrations = "../../migrations")]
async fn hidden_actors_page_without_skips_while_hides_land(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let mut kept = Vec::new();
    for n in 0..5 {
        let id = person(&rig.pool, &format!("pal{n}")).await;
        hide(&rig, &token, id).await;
        kept.push(id);
    }
    let late = person(&rig.pool, "late").await;
    let first = hidden(&rig, &token, json!({ "first": 2 })).await;
    assert_eq!(ids(&first), vec![kept[4], kept[3]]);
    hide(&rig, &token, late).await;
    let second = hidden(
        &rig,
        &token,
        json!({ "first": 2, "after": first["pageInfo"]["endCursor"] }),
    )
    .await;
    assert_eq!(ids(&second), vec![kept[2], kept[1]]);
    let back = hidden(
        &rig,
        &token,
        json!({ "last": 2, "before": second["pageInfo"]["startCursor"] }),
    )
    .await;
    assert_eq!(ids(&back), vec![kept[4], kept[3]]);
}

/// The count is the viewer's own hides, never another account's.
///
/// The hidden count is the viewer's own.
/// ´claim:hidden:the-count-is-the-viewers-own´
#[sqlx::test(migrations = "../../migrations")]
async fn hidden_actors_count_is_the_viewers_own(pool: PgPool) {
    let rig = rig(pool);
    let (_, mine) = reader(&rig, "reader").await;
    let (_, theirs) = reader(&rig, "other").await;
    let ada = person(&rig.pool, "ada").await;
    let sol = person(&rig.pool, "sol").await;
    hide(&rig, &mine, ada).await;
    hide(&rig, &theirs, ada).await;
    hide(&rig, &theirs, sol).await;
    assert_eq!(hidden(&rig, &mine, json!({})).await["totalCount"], 1);
    assert_eq!(hidden(&rig, &theirs, json!({})).await["totalCount"], 2);
}

/// Another account's hidden list is null, field-level — never an error.
///
/// The hidden list is viewer-only.
/// ´claim:hidden:viewer-only´
#[sqlx::test(migrations = "../../migrations")]
async fn hidden_actors_is_viewer_only(pool: PgPool) {
    let rig = rig(pool);
    let (_, owner) = reader(&rig, "owner").await;
    let (_, other) = reader(&rig, "other").await;
    let ada = person(&rig.pool, "ada").await;
    hide(&rig, &owner, ada).await;
    let query = r#"query { user(handle: "owner") { handle hiddenActors { totalCount } } }"#;
    let as_other = rig.gql_raw(Some(&other), query, json!({})).await;
    assert!(as_other["errors"].is_null(), "{as_other}");
    assert!(as_other["data"]["user"]["hiddenActors"].is_null());
    let anonymous = rig.gql_raw(None, query, json!({})).await;
    assert!(anonymous["data"]["user"]["hiddenActors"].is_null());
    let as_owner = rig.gql_raw(Some(&owner), query, json!({})).await;
    assert_eq!(as_owner["data"]["user"]["hiddenActors"]["totalCount"], 1);
}

/// Without a session there is no list to write to.
///
/// hideActor without a session is UNAUTHENTICATED.
/// ´claim:hidden:hide-needs-a-session´
#[sqlx::test(migrations = "../../migrations")]
async fn hide_without_a_session_is_unauthenticated(pool: PgPool) {
    let rig = rig(pool);
    let ada = person(&rig.pool, "ada").await;
    let response = rig.gql_raw(None, HIDE, json!({ "actor": ada })).await;
    assert_eq!(first_error_code(&response), Some("UNAUTHENTICATED"));
    assert_eq!(count(&rig.pool, "user_hidden_actors").await, 0);
}

/// Without a session there is no list to drop from.
///
/// unhideActor without a session is UNAUTHENTICATED.
/// ´claim:hidden:unhide-needs-a-session´
#[sqlx::test(migrations = "../../migrations")]
async fn unhide_without_a_session_is_unauthenticated(pool: PgPool) {
    let rig = rig(pool);
    let ada = person(&rig.pool, "ada").await;
    let response = rig.gql_raw(None, UNHIDE, json!({ "actor": ada })).await;
    assert_eq!(first_error_code(&response), Some("UNAUTHENTICATED"));
}

/// An id naming no actor is a client bug: NOT_FOUND at the transport.
///
/// Hiding an unknown actor is NOT_FOUND.
/// ´claim:hidden:an-unknown-actor-is-not-found´
#[sqlx::test(migrations = "../../migrations")]
async fn hiding_an_unknown_actor_is_not_found(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let response = rig
        .gql_raw(Some(&token), HIDE, json!({ "actor": Uuid::new_v4() }))
        .await;
    assert_eq!(first_error_code(&response), Some("NOT_FOUND"));
    assert_eq!(count(&rig.pool, "user_hidden_actors").await, 0);
}

/// No surface offers hiding yourself, so asking is a client bug.
///
/// Hiding yourself is BAD_INPUT.
/// ´claim:hidden:hiding-yourself-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn hiding_yourself_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let (me, token) = reader(&rig, "reader").await;
    let response = rig
        .gql_raw(Some(&token), HIDE, json!({ "actor": me }))
        .await;
    assert_eq!(first_error_code(&response), Some("BAD_INPUT"));
    assert_eq!(count(&rig.pool, "user_hidden_actors").await, 0);
}

/// An Undo may pass back only a moment that already passed (with a few
/// seconds of clock skew).
///
/// A restore moment after now is BAD_INPUT.
/// ´claim:hidden:a-future-restore-moment-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn a_restore_moment_after_now_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let ada = person(&rig.pool, "ada").await;
    let later = Utc::now() + Duration::minutes(5);
    let response = rig
        .gql_raw(
            Some(&token),
            HIDE,
            json!({ "actor": ada, "at": later.to_rfc3339() }),
        )
        .await;
    assert_eq!(first_error_code(&response), Some("BAD_INPUT"));
    assert_eq!(count(&rig.pool, "user_hidden_actors").await, 0);
}

/// A page past the cap, or a cursor this list did not issue, is a
/// malformed argument with its code.
///
/// The hidden list past the page cap is BAD_INPUT.
/// ´claim:hidden:over-the-page-cap-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn hidden_actors_over_the_page_cap_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    for variables in [json!({ "first": 101 }), json!({ "after": "not a cursor" })] {
        let response = rig.gql_raw(Some(&token), HIDDEN, variables.clone()).await;
        assert_eq!(
            first_error_code(&response),
            Some("BAD_INPUT"),
            "for {variables}"
        );
    }
}

/// Hiding is private viewer state, not acting: an applicant hides and
/// unhides like a member, never refused FORBIDDEN.
///
/// An applicant hides and unhides.
/// ´claim:hidden:applicants-hide´
#[sqlx::test(migrations = "../../migrations")]
async fn an_applicant_hides_and_unhides(pool: PgPool) {
    let rig = rig(pool);
    let (me, token) = reader(&rig, "applicant").await;
    sqlx::query("UPDATE user_credentials SET account_state = 'applicant' WHERE actor_id = $1")
        .bind(me)
        .execute(&rig.pool)
        .await
        .expect("applicant");
    let ada = person(&rig.pool, "ada").await;
    let response = rig
        .gql_raw(Some(&token), HIDE, json!({ "actor": ada }))
        .await;
    assert!(response["errors"].is_null(), "{response}");
    assert_eq!(unhide(&rig, &token, ada).await["ok"], true);
}

/// The email proof gates acting, not hiding.
///
/// An unverified applicant hides.
/// ´claim:hidden:unverified-accounts-hide´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unverified_applicant_hides(pool: PgPool) {
    let rig = rig(pool);
    let (me, token) = reader(&rig, "fresh").await;
    sqlx::query(
        "UPDATE user_credentials SET account_state = 'applicant', email_verified_at = NULL
          WHERE actor_id = $1",
    )
    .bind(me)
    .execute(&rig.pool)
    .await
    .expect("unverified");
    let ada = person(&rig.pool, "ada").await;
    let response = rig
        .gql_raw(Some(&token), HIDE, json!({ "actor": ada }))
        .await;
    assert!(response["errors"].is_null(), "{response}");
    assert_eq!(ids(&hidden(&rig, &token, json!({})).await), vec![ada]);
}

/// A deleted member's account keeps its actor, so it can be hidden, and
/// reads as its husk: the name gone, the mark standing (ER-G10).
///
/// A deleted account can be hidden.
/// ´claim:hidden:a-deleted-account-can-be-hidden´
#[sqlx::test(migrations = "../../migrations")]
async fn a_deleted_account_can_be_hidden(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
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
    hide(&rig, &token, gone).await;
    let page = hidden(&rig, &token, json!({})).await;
    assert_eq!(ids(&page), vec![gone]);
    assert_eq!(
        page["edges"][0]["node"]["displayName"]["status"],
        "REDACTED"
    );
}

/// Hiding stays in the app: no staged write, no record.
///
/// Hiding never becomes a graph record.
/// ´claim:hidden:hiding-is-never-a-graph-record´
#[sqlx::test(migrations = "../../migrations")]
async fn hiding_writes_no_staged_write_and_no_record(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let ada = person(&rig.pool, "ada").await;
    let (staged, records) = (
        count(&rig.pool, "staged_writes").await,
        count(&rig.pool, "mirror_records").await,
    );
    hide(&rig, &token, ada).await;
    unhide(&rig, &token, ada).await;
    hide(&rig, &token, ada).await;
    rig.close_and_ingest().await;
    assert_eq!(count(&rig.pool, "staged_writes").await, staged);
    assert_eq!(count(&rig.pool, "mirror_records").await, records);
    assert_eq!(count(&rig.pool, "user_hidden_actors").await, 1);
}

/// The hidden side cascades, so a never-verified account someone hid is
/// still reaped whole — its hides go with it.
///
/// The reaper reaps an account someone has hidden.
/// ´claim:hidden:the-reaper-reaps-a-hidden-account´
#[sqlx::test(migrations = "../../migrations")]
async fn the_reaper_reaps_an_account_someone_has_hidden(pool: PgPool) {
    let rig = rig(pool);
    let (_, token) = reader(&rig, "reader").await;
    let (stale, _) = rig.seed_member("stale", "stale@example.test").await;
    hide(&rig, &token, stale).await;
    sqlx::query(
        "UPDATE user_credentials
            SET email_verified_at = NULL, created_at = NOW() - INTERVAL '8 days'
          WHERE actor_id = $1",
    )
    .bind(stale)
    .execute(&rig.pool)
    .await
    .expect("unverify");
    let swept = postgres_store::auth::reap_unverified_accounts(
        &rig.pool,
        Utc::now() - Duration::days(api::onboarding::UNVERIFIED_TTL_DAYS),
    )
    .await
    .expect("reaps");
    assert!(swept >= 1);
    assert_eq!(count(&rig.pool, "user_hidden_actors").await, 0);
}
