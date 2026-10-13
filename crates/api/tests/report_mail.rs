//! The content report over the wire (api-spec.md `sendReport`;
//! feed-card-rework packet OC-7): the MVP's report is a mail to the
//! people who run CoGra, carrying the reporter, the reported node and the
//! time and nothing more, behind a session and a per-account daily budget.
//! Every refusal mails nothing.

mod rig;

use api::ratelimit::{RateLimitConfig, Window};
use api::report::CONTENT_REPORT_ADDRESS;
use postgres_store::content::{self, LandingOrder};
use postgres_store::genesis;
use rig::WireRig;
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

const SEND_REPORT: &str = r#"mutation($target: UUID!) {
  sendReport(input: { target: $target }) { reportedAt userErrors { code field } }
}"#;

fn landed(secs: i64) -> LandingOrder {
    LandingOrder {
        landed_epoch: secs,
        act_time: secs,
        position: 0,
    }
}

fn at(secs: i64) -> chrono::DateTime<chrono::Utc> {
    chrono::DateTime::from_timestamp(1_800_000_000 + secs, 0).expect("in range")
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

/// A landed post by `author`.
async fn post(pool: &PgPool, author: Uuid) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_post(
        &mut tx,
        id,
        author,
        &format!("mint:act:{id}:0:publish"),
        "a=0;o=0",
        Some(landed(1)),
        at(1),
        Some("A post"),
        None,
        "x",
        None,
    )
    .await
    .expect("post");
    tx.commit().await.expect("commit");
    id
}

/// A landed comment by `author` on the post `target`.
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
        Some(landed(2)),
        at(2),
        "a comment",
        None,
    )
    .await
    .expect("comment");
    tx.commit().await.expect("commit");
    id
}

/// A member with a session.
async fn reader(rig: &WireRig, handle: &str) -> (Uuid, String) {
    let email = format!("{handle}@example.test");
    let (id, _) = rig.seed_member(handle, &email).await;
    (id, rig.log_in(&email).await)
}

async fn report(rig: &WireRig, token: &str, target: Uuid) -> Value {
    rig.gql(Some(token), SEND_REPORT, json!({ "target": target }))
        .await["sendReport"]
        .clone()
}

fn first_error_code(response: &Value) -> Option<&str> {
    response["errors"][0]["extensions"]["code"].as_str()
}

/// The refusal a payload carries: its one userError's code and field.
fn refusal(payload: &Value) -> (String, Value) {
    let errors = payload["userErrors"].as_array().expect("userErrors");
    assert_eq!(errors.len(), 1, "one refusal: {payload}");
    (
        errors[0]["code"].as_str().expect("code").to_string(),
        errors[0]["field"].clone(),
    )
}

/// The report budget's shipped default is ten a day, and the eleventh
/// report of the day is a transport-tier RATE_LIMITED that mails nothing —
/// the ten before it each mailed once.
///
/// The eleventh report in a day is rate limited and mails nothing.
/// ´claim:report:the-daily-budget-refuses-the-eleventh-and-mails-nothing´
#[sqlx::test(migrations = "../../migrations")]
async fn the_eleventh_report_in_a_day_is_rate_limited_and_mails_nothing(pool: PgPool) {
    let shipped = RateLimitConfig::default().report_account;
    assert_eq!((shipped.limit, shipped.window_secs), (10, 86_400.0));
    let mut limits = RateLimitConfig::unlimited();
    limits.report_account = shipped;
    let rig = WireRig::new(pool, limits);
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let target = post(&rig.pool, sol).await;

    for _ in 0..10 {
        let sent = report(&rig, &token, target).await;
        assert_eq!(sent["userErrors"], json!([]), "{sent}");
        assert!(sent["reportedAt"].is_string(), "{sent}");
    }
    assert_eq!(rig.mailer.count(), 10);

    let refused = rig
        .gql_raw(Some(&token), SEND_REPORT, json!({ "target": target }))
        .await;
    assert_eq!(first_error_code(&refused), Some("RATE_LIMITED"));
    assert_eq!(rig.mailer.count(), 10, "a refused report mails nothing");
}

/// The server refuses a report without a session at the transport,
/// whatever the client draws, and mails nothing.
///
/// A report without a session is unauthenticated.
/// ´claim:report:a-report-needs-a-session´
#[sqlx::test(migrations = "../../migrations")]
async fn a_report_without_a_session_is_unauthenticated(pool: PgPool) {
    let rig = WireRig::new(pool, RateLimitConfig::unlimited());
    let sol = person(&rig.pool, "sol").await;
    let target = post(&rig.pool, sol).await;

    let refused = rig
        .gql_raw(None, SEND_REPORT, json!({ "target": target }))
        .await;
    assert_eq!(first_error_code(&refused), Some("UNAUTHENTICATED"));
    assert_eq!(rig.mailer.count(), 0);
}

/// An id naming no post, comment or profile — nothing at all, or a topic,
/// which is not a thing a report names — is NOT_FOUND at `["target"]`,
/// mails nothing and spends no budget.
///
/// Reporting an unknown node is not found and mails nothing.
/// ´claim:report:an-unknown-target-is-not-found´
#[sqlx::test(migrations = "../../migrations")]
async fn reporting_an_unknown_node_is_not_found_and_mails_nothing(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.report_account = Window {
        limit: 1,
        window_secs: 86_400.0,
    };
    let rig = WireRig::new(pool, limits);
    let (_, token) = reader(&rig, "reader").await;
    let topic = {
        let mut conn = rig.pool.acquire().await.expect("conn");
        postgres_store::hashtag::upsert(&mut conn, "walks")
            .await
            .expect("tag");
        common::hashtag_uuid("walks")
    };

    for unknown in [Uuid::new_v4(), topic] {
        let refused = report(&rig, &token, unknown).await;
        assert_eq!(refused["reportedAt"], Value::Null);
        assert_eq!(refusal(&refused), ("NOT_FOUND".into(), json!(["target"])));
    }
    assert_eq!(rig.mailer.count(), 0);

    // The refusals spent nothing: the one report the budget holds still goes.
    let sol = person(&rig.pool, "sol").await;
    let target = post(&rig.pool, sol).await;
    assert_eq!(report(&rig, &token, target).await["userErrors"], json!([]));
}

/// A reader's own post is BAD_INPUT at `["target"]` and mails nothing — the
/// row is drawn only on other people's menus, and the server holds the
/// same line; the reader's own comment and own profile answer alike.
///
/// Reporting your own post is bad input and mails nothing.
/// ´claim:report:your-own-thing-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn reporting_your_own_post_is_bad_input_and_mails_nothing(pool: PgPool) {
    let rig = WireRig::new(pool, RateLimitConfig::unlimited());
    let (me, token) = reader(&rig, "reader").await;
    let own_post = post(&rig.pool, me).await;
    let own_comment = comment(&rig.pool, me, own_post).await;

    for own in [own_post, own_comment, me] {
        let refused = report(&rig, &token, own).await;
        assert_eq!(refused["reportedAt"], Value::Null);
        assert_eq!(refusal(&refused), ("BAD_INPUT".into(), json!(["target"])));
    }
    assert_eq!(rig.mailer.count(), 0);
}

/// The one mail a report sends goes to the content-report address and
/// carries the reporter's account id and handle, the reported node's id
/// and kind, and the server's UTC time of the report — the time the
/// payload answers — and nothing else: no reason, no snapshot, no reply
/// address.
///
/// A report mails the reporter, the target and the time only.
/// ´claim:report:the-mail-carries-reporter-target-and-time-only´
#[sqlx::test(migrations = "../../migrations")]
async fn a_report_mails_the_reporter_the_target_and_the_time_only(pool: PgPool) {
    let rig = WireRig::new(pool, RateLimitConfig::unlimited());
    let (me, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let target = post(&rig.pool, sol).await;

    let sent = report(&rig, &token, target).await;
    assert_eq!(sent["userErrors"], json!([]));
    let reported_at =
        chrono::DateTime::parse_from_rfc3339(sent["reportedAt"].as_str().expect("reportedAt"))
            .expect("RFC 3339")
            .to_utc();

    assert_eq!(rig.mailer.count(), 1);
    assert_eq!(
        rig.mailer.subjects_for(CONTENT_REPORT_ADDRESS),
        vec![format!("CoGra content report: post {target}")]
    );
    let stamp = reported_at.to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
    assert_eq!(
        rig.mailer.latest_body_for(CONTENT_REPORT_ADDRESS),
        format!("Reporter: {me} (@reader)\nReported: post {target}\nAt: {stamp}")
    );
}

/// A comment and a person's profile are reportable too, and each mail
/// names the thing by its own kind.
///
/// A comment and a profile are reported under their own kinds.
/// ´claim:report:a-comment-and-a-profile-report-by-kind´
#[sqlx::test(migrations = "../../migrations")]
async fn a_comment_and_a_profile_are_reported_under_their_own_kinds(pool: PgPool) {
    let rig = WireRig::new(pool, RateLimitConfig::unlimited());
    let (_, token) = reader(&rig, "reader").await;
    let sol = person(&rig.pool, "sol").await;
    let on = post(&rig.pool, sol).await;
    let remark = comment(&rig.pool, sol, on).await;

    assert_eq!(report(&rig, &token, remark).await["userErrors"], json!([]));
    assert!(
        rig.mailer
            .latest_body_for(CONTENT_REPORT_ADDRESS)
            .contains(&format!("Reported: comment {remark}\n"))
    );
    assert_eq!(report(&rig, &token, sol).await["userErrors"], json!([]));
    assert!(
        rig.mailer
            .latest_body_for(CONTENT_REPORT_ADDRESS)
            .contains(&format!("Reported: user {sol}\n"))
    );
}
