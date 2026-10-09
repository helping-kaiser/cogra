//! Device locks through the real HTTP surface (api-spec.md "Auth and
//! accounts"; auth.md "Device lock"): the server half of a signed-out
//! device's locked custody — issued per account under a budget and a live
//! cap, released only behind the account's current password through the
//! shared re-authentication budget, discarded silently, and never touched
//! by any session revocation. Requires a live Postgres (`make up`).

use api::ratelimit::RateLimitConfig;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use chrono::{Duration, Utc};
use postgres_store::PgPool;
use serde_json::{Value, json};
use uuid::Uuid;

mod rig;
use rig::{MEMBER_PASSWORD, WireRig};

const NEW_PASSWORD: &str = "another strong password";

const ISSUE: &str = "mutation {
    issueDeviceLock { lock { id secret } userErrors { code field } }
}";
const RELEASE: &str = "mutation($input: ReleaseDeviceLockInput!) {
    releaseDeviceLock(input: $input) { secret userErrors { code field } }
}";
const DISCARD: &str = "mutation($input: DiscardDeviceLockInput!) {
    discardDeviceLock(input: $input) { ok userErrors { code field } }
}";
const CHANGE_PASSWORD: &str = "mutation($input: ChangePasswordInput!) {
    changePassword(input: $input) { ok userErrors { code field } }
}";
const LOG_IN: &str = "mutation($input: LogInInput!) {
    logIn(input: $input) { auth { accessToken refreshToken } userErrors { code } }
}";
const REFRESH: &str = "mutation($input: RefreshSessionInput!) {
    refreshSession(input: $input) { auth { refreshToken } userErrors { code } }
}";

fn rig(pool: PgPool) -> WireRig {
    WireRig::new(pool, RateLimitConfig::unlimited())
}

/// A rig whose re-authentication backoff bites at the third consecutive
/// wrong password and holds for a minute — the settings suite's shape.
fn reauth_rig(pool: PgPool) -> WireRig {
    let mut limits = RateLimitConfig::unlimited();
    limits.reauth_backoff_threshold = 3;
    limits.reauth_backoff_base_secs = 60.0;
    limits.reauth_backoff_cap_secs = 60.0;
    WireRig::new(pool, limits)
}

fn codes<'a>(data: &'a Value, operation: &str) -> Vec<&'a str> {
    data[operation]["userErrors"]
        .as_array()
        .expect("userErrors")
        .iter()
        .map(|e| e["code"].as_str().expect("code"))
        .collect()
}

fn fields(data: &Value, operation: &str) -> Vec<Value> {
    data[operation]["userErrors"]
        .as_array()
        .expect("userErrors")
        .iter()
        .map(|e| e["field"].clone())
        .collect()
}

fn transport_code(response: &Value) -> Option<&str> {
    response["errors"][0]["extensions"]["code"].as_str()
}

/// A lock the device now holds: its id and secret, as the wire carries
/// them.
struct Held {
    id: String,
    secret: String,
}

async fn issue(rig: &WireRig, token: &str) -> Held {
    let data = rig.gql(Some(token), ISSUE, json!({})).await;
    assert_eq!(codes(&data, "issueDeviceLock"), Vec::<&str>::new());
    let lock = &data["issueDeviceLock"]["lock"];
    Held {
        id: lock["id"].as_str().expect("id").to_string(),
        secret: lock["secret"].as_str().expect("secret").to_string(),
    }
}

async fn release(rig: &WireRig, token: &str, lock: &str, password: &str) -> Value {
    rig.gql_raw(
        Some(token),
        RELEASE,
        json!({ "input": { "lock": lock, "password": password } }),
    )
    .await
}

async fn discard(rig: &WireRig, token: &str, lock: &str) -> Value {
    rig.gql(Some(token), DISCARD, json!({ "input": { "lock": lock } }))
        .await
}

/// The secret a release answered, or the test fails with what it got.
fn released(response: &Value) -> &str {
    assert!(
        response.get("errors").is_none(),
        "unexpected transport errors: {response}"
    );
    response["data"]["releaseDeviceLock"]["secret"]
        .as_str()
        .unwrap_or_else(|| panic!("no secret released: {response}"))
}

async fn lock_rows(pool: &PgPool, user: Uuid) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM auth_device_locks WHERE user_id = $1")
        .bind(user)
        .fetch_one(pool)
        .await
        .expect("count")
}

/// A fresh session with its refresh token, for the revocation paths.
async fn log_in_whole(rig: &WireRig, email: &str, password: &str) -> (String, String) {
    let data = rig
        .gql(
            None,
            LOG_IN,
            json!({ "input": { "email": email, "password": password } }),
        )
        .await;
    let auth = &data["logIn"]["auth"];
    (
        auth["accessToken"].as_str().expect("access").to_string(),
        auth["refreshToken"].as_str().expect("refresh").to_string(),
    )
}

/// Issuing hands the device a fresh lock: a 32-byte secret under an id,
/// both distinct per issue, and the server keeps exactly what it handed
/// out.
///
/// Issuing a device lock hands the device a fresh 32-byte secret under its own id, and the server keeps exactly that secret.
/// ´claim:device-lock:an-issue-returns-a-fresh-32-byte-secret´
#[sqlx::test(migrations = "../../migrations")]
async fn issuing_a_device_lock_returns_a_fresh_32_byte_secret(pool: PgPool) {
    let rig = rig(pool);
    let (alice, _) = rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;

    let first = issue(&rig, &token).await;
    let second = issue(&rig, &token).await;
    assert_ne!(first.id, second.id);
    assert_ne!(first.secret, second.secret);
    for held in [&first, &second] {
        let bytes = B64.decode(&held.secret).expect("base64");
        assert_eq!(bytes.len(), 32);
        let stored: Vec<u8> = sqlx::query_scalar(
            "SELECT secret FROM auth_device_locks WHERE id = $1 AND user_id = $2",
        )
        .bind(Uuid::parse_str(&held.id).expect("uuid"))
        .bind(alice)
        .fetch_one(&rig.pool)
        .await
        .expect("row");
        assert_eq!(stored, bytes);
    }
}

/// Every verb is the signed-in account's: without a session each refuses
/// at the transport tier and nothing is written.
///
/// Each device-lock verb refuses UNAUTHENTICATED without a session.
/// ´claim:device-lock:the-verbs-need-a-session´
#[sqlx::test(migrations = "../../migrations")]
async fn device_lock_verbs_need_a_session(pool: PgPool) {
    let rig = rig(pool);
    let lock = Uuid::new_v4().to_string();
    for (query, variables) in [
        (ISSUE, json!({})),
        (
            RELEASE,
            json!({ "input": { "lock": lock, "password": MEMBER_PASSWORD } }),
        ),
        (DISCARD, json!({ "input": { "lock": lock } })),
    ] {
        let refused = rig.gql_raw(None, query, variables).await;
        assert_eq!(transport_code(&refused), Some("UNAUTHENTICATED"), "{query}");
    }
    let rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM auth_device_locks")
        .fetch_one(&rig.pool)
        .await
        .expect("count");
    assert_eq!(rows, 0);
}

/// The issue budget is per account and visible: past it the next issue is
/// RATE_LIMITED and stores nothing, while another account still issues.
///
/// Device-lock issues past the account's budget answer RATE_LIMITED and store nothing, and the budget is per account.
/// ´claim:device-lock:issues-trip-the-account-budget´
#[sqlx::test(migrations = "../../migrations")]
async fn device_lock_issues_trip_the_account_budget(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.device_lock_issue_account.limit = 2;
    limits.device_lock_issue_account.window_secs = 3600.0;
    let rig = WireRig::new(pool, limits);
    let (alice, _) = rig.seed_member("alice", "alice@example.com").await;
    rig.seed_member("bob", "bob@example.com").await;
    let token = rig.log_in("alice@example.com").await;

    issue(&rig, &token).await;
    issue(&rig, &token).await;
    let refused = rig.gql_raw(Some(&token), ISSUE, json!({})).await;
    assert_eq!(transport_code(&refused), Some("RATE_LIMITED"));
    assert_eq!(lock_rows(&rig.pool, alice).await, 2);

    let bob = rig.log_in("bob@example.com").await;
    issue(&rig, &bob).await;
}

/// The live cap bounds what one account holds whatever the window says:
/// at the cap an issue is RATE_LIMITED and stores nothing, and a discard
/// makes room again.
///
/// An account at its live-lock cap is refused RATE_LIMITED until one of its locks is discarded.
/// ´claim:device-lock:the-live-cap-answers-rate-limited´
#[sqlx::test(migrations = "../../migrations")]
async fn the_live_lock_cap_answers_rate_limited(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.device_lock_live_cap = 2;
    let rig = WireRig::new(pool, limits);
    let (alice, _) = rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;

    let first = issue(&rig, &token).await;
    issue(&rig, &token).await;
    let refused = rig.gql_raw(Some(&token), ISSUE, json!({})).await;
    assert_eq!(transport_code(&refused), Some("RATE_LIMITED"));
    assert_eq!(lock_rows(&rig.pool, alice).await, 2);

    discard(&rig, &token, &first.id).await;
    issue(&rig, &token).await;
    assert_eq!(lock_rows(&rig.pool, alice).await, 2);
}

/// The cap holds under a burst: issues racing at the cap's edge serialize
/// on the account, so exactly the cap's worth land and the rest refuse.
///
/// Concurrent issues never carry an account past its live-lock cap.
/// ´claim:device-lock:the-live-cap-holds-under-concurrent-issues´
#[sqlx::test(migrations = "../../migrations")]
async fn the_live_lock_cap_holds_under_concurrent_issues(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.device_lock_live_cap = 3;
    let rig = WireRig::new(pool, limits);
    let (alice, _) = rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;

    let call = || rig.gql_raw(Some(&token), ISSUE, json!({}));
    let (a, b, c, d, e, f) = tokio::join!(call(), call(), call(), call(), call(), call());
    let answers = [a, b, c, d, e, f];
    let issued = answers
        .iter()
        .filter(|r| r["data"]["issueDeviceLock"]["lock"]["id"].is_string())
        .count();
    let refused = answers
        .iter()
        .filter(|r| transport_code(r) == Some("RATE_LIMITED"))
        .count();
    assert_eq!((issued, refused), (3, 3), "{answers:?}");
    assert_eq!(lock_rows(&rig.pool, alice).await, 3);
}

/// The current password releases exactly the secret the issue handed out.
///
/// A device lock releases its own secret behind the account's current password.
/// ´claim:device-lock:the-current-password-releases-the-secret´
#[sqlx::test(migrations = "../../migrations")]
async fn releasing_a_lock_with_the_current_password_returns_its_secret(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;
    let held = issue(&rig, &token).await;

    let answer = release(&rig, &token, &held.id, MEMBER_PASSWORD).await;
    assert_eq!(released(&answer), held.secret);
}

/// A wrong password is the password field's INVALID_CREDENTIALS, and no
/// secret rides the refusal.
///
/// A wrong password never releases a lock's secret and answers INVALID_CREDENTIALS at the password.
/// ´claim:device-lock:a-wrong-password-never-releases´
#[sqlx::test(migrations = "../../migrations")]
async fn a_wrong_password_never_releases_and_is_invalid_credentials(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;
    let held = issue(&rig, &token).await;

    let refused = release(&rig, &token, &held.id, "not the password").await;
    let data = &refused["data"];
    assert_eq!(
        codes(data, "releaseDeviceLock"),
        vec!["INVALID_CREDENTIALS"]
    );
    assert_eq!(fields(data, "releaseDeviceLock"), vec![json!(["password"])]);
    assert!(data["releaseDeviceLock"]["secret"].is_null());
}

/// A reset by mail moves the hash, and release re-verifies against the
/// hash as it stands: the old password no longer opens the lock, the new
/// one does.
///
/// After a password reset the old password cannot release a device lock and the new one can.
/// ´claim:device-lock:the-old-password-cannot-release-after-a-reset´
#[sqlx::test(migrations = "../../migrations")]
async fn the_old_password_cannot_release_after_a_reset(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;
    let held = issue(&rig, &token).await;

    rig.gql(
        None,
        "mutation($input: RequestPasswordResetInput!) { requestPasswordReset(input: $input) { ok } }",
        json!({ "input": { "email": "alice@example.com" } }),
    )
    .await;
    let reset_token = rig.mailer.latest_token_for("alice@example.com");
    let confirmed = rig
        .gql(
            None,
            "mutation($input: ConfirmPasswordResetInput!) {
                confirmPasswordReset(input: $input) { ok userErrors { code } }
            }",
            json!({ "input": { "resetToken": reset_token, "newPassword": NEW_PASSWORD } }),
        )
        .await;
    assert_eq!(confirmed["confirmPasswordReset"]["ok"], json!(true));

    let (fresh, _) = log_in_whole(&rig, "alice@example.com", NEW_PASSWORD).await;
    let old = release(&rig, &fresh, &held.id, MEMBER_PASSWORD).await;
    assert_eq!(
        codes(&old["data"], "releaseDeviceLock"),
        vec!["INVALID_CREDENTIALS"]
    );
    let new = release(&rig, &fresh, &held.id, NEW_PASSWORD).await;
    assert_eq!(released(&new), held.secret);
}

/// A password changed from another device behaves the same way: the lock
/// this device holds answers only the password as it now stands.
///
/// After a password change on another device the old password cannot release a device lock and the new one can.
/// ´claim:device-lock:the-old-password-cannot-release-after-a-change´
#[sqlx::test(migrations = "../../migrations")]
async fn the_old_password_cannot_release_after_a_change_elsewhere(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let here = rig.log_in("alice@example.com").await;
    let elsewhere = rig.log_in("alice@example.com").await;
    let held = issue(&rig, &here).await;

    let changed = rig
        .gql(
            Some(&elsewhere),
            CHANGE_PASSWORD,
            json!({ "input": { "currentPassword": MEMBER_PASSWORD, "newPassword": NEW_PASSWORD } }),
        )
        .await;
    assert_eq!(changed["changePassword"]["ok"], json!(true));

    let (fresh, _) = log_in_whole(&rig, "alice@example.com", NEW_PASSWORD).await;
    let old = release(&rig, &fresh, &held.id, MEMBER_PASSWORD).await;
    assert_eq!(
        codes(&old["data"], "releaseDeviceLock"),
        vec!["INVALID_CREDENTIALS"]
    );
    let new = release(&rig, &fresh, &held.id, NEW_PASSWORD).await;
    assert_eq!(released(&new), held.secret);
}

/// Locks are scoped to their account: another account, with its own right
/// password, reads someone else's lock as NOT_FOUND at the lock field.
///
/// Another account's device lock is NOT_FOUND, even behind that caller's own right password.
/// ´claim:device-lock:another-accounts-lock-is-not-found´
#[sqlx::test(migrations = "../../migrations")]
async fn another_accounts_lock_is_not_found(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    rig.seed_member("bob", "bob@example.com").await;
    let alice = rig.log_in("alice@example.com").await;
    let bob = rig.log_in("bob@example.com").await;
    let held = issue(&rig, &alice).await;

    let refused = release(&rig, &bob, &held.id, MEMBER_PASSWORD).await;
    let data = &refused["data"];
    assert_eq!(codes(data, "releaseDeviceLock"), vec!["NOT_FOUND"]);
    assert_eq!(fields(data, "releaseDeviceLock"), vec![json!(["lock"])]);
    assert!(data["releaseDeviceLock"]["secret"].is_null());
}

/// Once discarded a lock is gone: its release is NOT_FOUND.
///
/// A discarded device lock is NOT_FOUND at release.
/// ´claim:device-lock:a-discarded-lock-is-not-found´
#[sqlx::test(migrations = "../../migrations")]
async fn a_discarded_lock_is_not_found(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;
    let held = issue(&rig, &token).await;

    discard(&rig, &token, &held.id).await;
    let refused = release(&rig, &token, &held.id, MEMBER_PASSWORD).await;
    assert_eq!(
        codes(&refused["data"], "releaseDeviceLock"),
        vec!["NOT_FOUND"]
    );
}

/// Without the password nothing about locks is probeable: a wrong
/// password answers INVALID_CREDENTIALS whether the named lock exists,
/// is someone else's, or never existed.
///
/// A wrong password answers INVALID_CREDENTIALS before any lock is looked up, so lock existence cannot be probed.
/// ´claim:device-lock:no-probe-without-the-password´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unknown_lock_with_a_wrong_password_is_invalid_credentials_not_not_found(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    rig.seed_member("bob", "bob@example.com").await;
    let alice = rig.log_in("alice@example.com").await;
    let bob = rig.log_in("bob@example.com").await;
    let alices = issue(&rig, &alice).await;
    let bobs = issue(&rig, &bob).await;

    for lock in [alices.id, bobs.id, Uuid::new_v4().to_string()] {
        let refused = release(&rig, &alice, &lock, "not the password").await;
        assert_eq!(
            codes(&refused["data"], "releaseDeviceLock"),
            vec!["INVALID_CREDENTIALS"],
            "{lock}"
        );
    }
}

/// A release never spends the lock: asked again — and asked twice at
/// once, the retry racing the lost first answer — it hands back the same
/// secret every time, and the row stays.
///
/// Releasing a device lock is idempotent and never spends it, concurrent releases included.
/// ´claim:device-lock:release-is-idempotent´
#[sqlx::test(migrations = "../../migrations")]
async fn release_is_idempotent_and_never_spends_the_lock(pool: PgPool) {
    let rig = rig(pool);
    let (alice, _) = rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;
    let held = issue(&rig, &token).await;

    let first = release(&rig, &token, &held.id, MEMBER_PASSWORD).await;
    assert_eq!(released(&first), held.secret);
    let (a, b) = tokio::join!(
        release(&rig, &token, &held.id, MEMBER_PASSWORD),
        release(&rig, &token, &held.id, MEMBER_PASSWORD),
    );
    assert_eq!(released(&a), held.secret);
    assert_eq!(released(&b), held.secret);
    assert_eq!(lock_rows(&rig.pool, alice).await, 1);
}

/// Wrong release passwords spend the account's re-authentication run:
/// at the threshold the next release — even with the right password — is
/// a visible RATE_LIMITED, answered before the lock is reached.
///
/// Consecutive wrong release passwords trip the account's re-authentication backoff, visibly.
/// ´claim:device-lock:wrong-release-passwords-spend-the-reauth-budget´
#[sqlx::test(migrations = "../../migrations")]
async fn wrong_release_passwords_spend_the_reauth_budget(pool: PgPool) {
    let rig = reauth_rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;
    let held = issue(&rig, &token).await;

    for _ in 0..3 {
        let refused = release(&rig, &token, &held.id, "not the password").await;
        assert_eq!(
            codes(&refused["data"], "releaseDeviceLock"),
            vec!["INVALID_CREDENTIALS"]
        );
    }
    let blocked = release(&rig, &token, &held.id, MEMBER_PASSWORD).await;
    assert_eq!(transport_code(&blocked), Some("RATE_LIMITED"));
}

/// One run, every verb: wrong passwords at release and at changePassword
/// count toward the same threshold, so neither verb is a fresh supply of
/// guesses for the other — whichever comes last is the one refused.
///
/// The re-authentication budget is one per account, shared by releaseDeviceLock and changePassword.
/// ´claim:device-lock:the-reauth-budget-is-shared-with-change-password´
#[sqlx::test(migrations = "../../migrations")]
async fn the_reauth_budget_is_shared_by_release_and_change_password(pool: PgPool) {
    let rig = reauth_rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    rig.seed_member("bob", "bob@example.com").await;
    let alice = rig.log_in("alice@example.com").await;
    let held = issue(&rig, &alice).await;

    for _ in 0..2 {
        release(&rig, &alice, &held.id, "not the password").await;
    }
    let wrong_change = rig
        .gql(
            Some(&alice),
            CHANGE_PASSWORD,
            json!({ "input": { "currentPassword": "not the password", "newPassword": NEW_PASSWORD } }),
        )
        .await;
    assert_eq!(
        codes(&wrong_change, "changePassword"),
        vec!["INVALID_CREDENTIALS"]
    );
    let blocked = release(&rig, &alice, &held.id, MEMBER_PASSWORD).await;
    assert_eq!(transport_code(&blocked), Some("RATE_LIMITED"));

    let bob = rig.log_in("bob@example.com").await;
    let bobs = issue(&rig, &bob).await;
    for _ in 0..3 {
        release(&rig, &bob, &bobs.id, "not the password").await;
    }
    let blocked_change = rig
        .gql_raw(
            Some(&bob),
            CHANGE_PASSWORD,
            json!({ "input": { "currentPassword": MEMBER_PASSWORD, "newPassword": NEW_PASSWORD } }),
        )
        .await;
    assert_eq!(transport_code(&blocked_change), Some("RATE_LIMITED"));
}

/// Discarding is idempotent and says nothing: a second discard and a
/// never-issued id answer exactly like the first.
///
/// Discarding a device lock is idempotent and answers an unknown id exactly like a known one.
/// ´claim:device-lock:discard-is-idempotent-and-silent´
#[sqlx::test(migrations = "../../migrations")]
async fn discarding_a_lock_is_idempotent_and_silent_for_unknown_ids(pool: PgPool) {
    let rig = rig(pool);
    let (alice, _) = rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;
    let held = issue(&rig, &token).await;

    let unknown = Uuid::new_v4().to_string();
    for lock in [&held.id, &held.id, &unknown] {
        let answer = discard(&rig, &token, lock).await;
        assert_eq!(answer["discardDeviceLock"]["ok"], json!(true));
        assert_eq!(codes(&answer, "discardDeviceLock"), Vec::<&str>::new());
    }
    assert_eq!(lock_rows(&rig.pool, alice).await, 0);
}

/// A discard names an id, but only the caller's own locks are reachable by
/// it: another account's lock survives, still releasable by its owner.
///
/// A discard never reaches another account's device lock.
/// ´claim:device-lock:discard-never-reaches-another-account´
#[sqlx::test(migrations = "../../migrations")]
async fn discard_never_reaches_another_accounts_lock(pool: PgPool) {
    let rig = rig(pool);
    let (alice_id, _) = rig.seed_member("alice", "alice@example.com").await;
    rig.seed_member("bob", "bob@example.com").await;
    let alice = rig.log_in("alice@example.com").await;
    let bob = rig.log_in("bob@example.com").await;
    let held = issue(&rig, &alice).await;

    let answer = discard(&rig, &bob, &held.id).await;
    assert_eq!(answer["discardDeviceLock"]["ok"], json!(true));
    assert_eq!(lock_rows(&rig.pool, alice_id).await, 1);
    let still = release(&rig, &alice, &held.id, MEMBER_PASSWORD).await;
    assert_eq!(released(&still), held.secret);
}

/// A revoked session says nothing about the actor (auth.md "Sessions"):
/// no revocation path — the owner's own, revoke-others, a password change,
/// a reset, a reuse detection — touches a lock, and each lock still
/// releases afterwards behind the password as it then stands.
///
/// No session revocation of any kind touches a device lock.
/// ´claim:device-lock:session-revocations-never-touch-locks´
#[sqlx::test(migrations = "../../migrations")]
async fn session_revocations_never_touch_device_locks(pool: PgPool) {
    let rig = rig(pool);
    let (alice, _) = rig.seed_member("alice", "alice@example.com").await;
    let email = "alice@example.com";

    // The owner's own revoke, and revoke-others.
    let (one, _) = log_in_whole(&rig, email, MEMBER_PASSWORD).await;
    let (two, _) = log_in_whole(&rig, email, MEMBER_PASSWORD).await;
    let first = issue(&rig, &one).await;
    let second = issue(&rig, &two).await;
    rig.gql(
        Some(&one),
        "mutation { revokeSession(input: {}) { session { id } userErrors { code } } }",
        json!({}),
    )
    .await;
    rig.gql(
        Some(&two),
        "mutation { revokeOtherSessions { revokedCount userErrors { code } } }",
        json!({}),
    )
    .await;
    assert_eq!(lock_rows(&rig.pool, alice).await, 2);

    // A password change revokes the others.
    let (three, _) = log_in_whole(&rig, email, MEMBER_PASSWORD).await;
    let changed = rig
        .gql(
            Some(&three),
            CHANGE_PASSWORD,
            json!({ "input": { "currentPassword": MEMBER_PASSWORD, "newPassword": NEW_PASSWORD } }),
        )
        .await;
    assert_eq!(changed["changePassword"]["ok"], json!(true));
    assert_eq!(lock_rows(&rig.pool, alice).await, 2);

    // A reset revokes all.
    rig.gql(
        None,
        "mutation($input: RequestPasswordResetInput!) { requestPasswordReset(input: $input) { ok } }",
        json!({ "input": { "email": email } }),
    )
    .await;
    let reset_token = rig.mailer.latest_token_for(email);
    rig.gql(
        None,
        "mutation($input: ConfirmPasswordResetInput!) {
            confirmPasswordReset(input: $input) { ok userErrors { code } }
        }",
        json!({ "input": { "resetToken": reset_token, "newPassword": MEMBER_PASSWORD } }),
    )
    .await;
    assert_eq!(lock_rows(&rig.pool, alice).await, 2);

    // Reuse detection revokes all: a rotated token replayed past grace.
    let (four, refresh) = log_in_whole(&rig, email, MEMBER_PASSWORD).await;
    let third = issue(&rig, &four).await;
    let rotated = rig
        .gql(
            None,
            REFRESH,
            json!({ "input": { "refreshToken": refresh } }),
        )
        .await;
    assert!(rotated["refreshSession"]["auth"]["refreshToken"].is_string());
    sqlx::query(
        "UPDATE auth_refresh_tokens SET revoked_at = revoked_at - INTERVAL '11 seconds'
          WHERE revoked_at IS NOT NULL",
    )
    .execute(&rig.pool)
    .await
    .expect("backdate");
    let replay = rig
        .gql(
            None,
            REFRESH,
            json!({ "input": { "refreshToken": refresh } }),
        )
        .await;
    assert_eq!(
        codes(&replay, "refreshSession"),
        vec!["REFRESH_TOKEN_INVALID"]
    );
    let reused: bool = sqlx::query_scalar(
        "SELECT reuse_detected_at IS NOT NULL FROM user_credentials WHERE actor_id = $1",
    )
    .bind(alice)
    .fetch_one(&rig.pool)
    .await
    .expect("mark");
    assert!(reused, "the replay was read as theft");
    assert_eq!(lock_rows(&rig.pool, alice).await, 3);

    let (fresh, _) = log_in_whole(&rig, email, MEMBER_PASSWORD).await;
    for held in [first, second, third] {
        let answer = release(&rig, &fresh, &held.id, MEMBER_PASSWORD).await;
        assert_eq!(released(&answer), held.secret);
    }
}

/// The reaper deletes a never-verified account whole, and its locks go
/// with it — any ciphertext a device still holds for it is then
/// permanently unopenable.
///
/// Reaping a never-verified account deletes its device locks with it.
/// ´claim:device-lock:the-reaper-deletes-device-locks´
#[sqlx::test(migrations = "../../migrations")]
async fn the_reaper_deletes_device_locks(pool: PgPool) {
    let rig = rig(pool);
    let (alice, _) = rig.seed_member("alice", "alice@example.com").await;
    let (bob, _) = rig.seed_member("bob", "bob@example.com").await;
    let alice_token = rig.log_in("alice@example.com").await;
    let bob_token = rig.log_in("bob@example.com").await;
    issue(&rig, &alice_token).await;
    issue(&rig, &bob_token).await;

    sqlx::query(
        "UPDATE user_credentials
            SET email_verified_at = NULL, created_at = NOW() - INTERVAL '8 days'
          WHERE actor_id = $1",
    )
    .bind(alice)
    .execute(&rig.pool)
    .await
    .expect("unverify");
    let swept = postgres_store::auth::reap_unverified_accounts(
        &rig.pool,
        Utc::now() - Duration::days(api::onboarding::UNVERIFIED_TTL_DAYS),
    )
    .await
    .expect("reaps");
    assert_eq!(swept, 1);
    assert_eq!(lock_rows(&rig.pool, alice).await, 0);
    assert_eq!(
        lock_rows(&rig.pool, bob).await,
        1,
        "a live account keeps its lock"
    );
}
