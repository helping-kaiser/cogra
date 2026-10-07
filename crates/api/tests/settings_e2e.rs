//! The Settings surface's account verbs and reads through the real HTTP
//! surface: the password change and its re-authentication budget, the
//! handle change's two refusals, session revocation, the password's age,
//! and the cross-device preferences (api-spec.md "Auth and accounts",
//! "Private viewer state"; auth.md "Password change", "Rate limiting").
//! Requires a live Postgres (`make up`).

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use api::breach::{BreachCorpus, BreachError};
use api::ratelimit::RateLimitConfig;
use chrono::{DateTime, Utc};
use postgres_store::PgPool;
use serde_json::{Value, json};
use uuid::Uuid;

mod rig;
use rig::{MEMBER_PASSWORD, TestMailer, WireRig};

/// A corpus that knows exactly one password.
struct OneBreachedPassword;

const BREACHED: &str = "correct horse battery staple";

impl BreachCorpus for OneBreachedPassword {
    fn is_breached<'a>(
        &'a self,
        password: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<bool, BreachError>> + Send + 'a>> {
        Box::pin(async move { Ok(password == BREACHED) })
    }
}

fn rig(pool: PgPool) -> WireRig {
    WireRig::new(pool, RateLimitConfig::unlimited())
}

/// A rig whose breach corpus knows [`BREACHED`].
fn breach_rig(pool: PgPool) -> WireRig {
    let mailer = Arc::new(TestMailer::default());
    let (mut ctx, auth) =
        rig::api_context(pool.clone(), mailer.clone(), RateLimitConfig::unlimited());
    ctx.breach = Arc::new(OneBreachedPassword);
    let standin = ctx.funding.clone();
    let uploads = rig::upload_routing(&ctx);
    let app = api::app(
        api::schema::build(ctx),
        auth,
        axum_client_ip::ClientIpSource::ConnectInfo,
        uploads,
    )
    .layer(axum::Extension(axum::extract::ConnectInfo(
        std::net::SocketAddr::from(([127, 0, 0, 1], 9999)),
    )));
    WireRig {
        app,
        pool,
        standin,
        mailer,
    }
}

/// A rig whose re-authentication backoff bites at the third consecutive
/// wrong password and holds for a minute.
fn reauth_rig(pool: PgPool) -> WireRig {
    let mut limits = RateLimitConfig::unlimited();
    limits.reauth_backoff_threshold = 3;
    limits.reauth_backoff_base_secs = 60.0;
    limits.reauth_backoff_cap_secs = 60.0;
    WireRig::new(pool, limits)
}

const CHANGE_PASSWORD: &str = "mutation($input: ChangePasswordInput!) {
    changePassword(input: $input) { ok userErrors { code field } }
}";
const CHANGE_HANDLE: &str = "mutation($input: ChangeHandleInput!) {
    changeHandle(input: $input) { user { handle } userErrors { code field } }
}";
const REQUEST_EMAIL_CHANGE: &str = "mutation($input: RequestEmailChangeInput!) {
    requestEmailChange(input: $input) { pendingEmailChange { newEmail } userErrors { code field } }
}";
const REVOKE_SESSION: &str = "mutation($input: RevokeSessionInput!) {
    revokeSession(input: $input) { session { id } userErrors { code field } }
}";
const REVOKE_OTHERS: &str = "mutation {
    revokeOtherSessions { revokedCount userErrors { code } }
}";
const REFRESH: &str = "mutation($input: RefreshSessionInput!) {
    refreshSession(input: $input) { auth { accessToken } userErrors { code } }
}";
const LOG_IN: &str = "mutation($input: LogInInput!) {
    logIn(input: $input) { auth { accessToken refreshToken session { id } } userErrors { code } }
}";
const ME_SESSIONS: &str = "{ me { sessions { id isCurrent } } }";
const ME_PASSWORD_AGE: &str = "{ me { passwordChangedAt } }";
const ME_PREFERENCES: &str = "{ me { preferences {
    contentFilteringSeverityLevel
    defaultLicense { attribution provenance }
    hasSeenOnboarding
} } }";
const SET_PREFERENCES: &str = "mutation($input: SetPreferencesInput!) {
    setPreferences(input: $input) {
        preferences {
            contentFilteringSeverityLevel
            defaultLicense { attribution provenance }
            hasSeenOnboarding
        }
        userErrors { code field }
    }
}";
const USER_BY_HANDLE: &str = "query($handle: String!) {
    user(handle: $handle) {
        passwordChangedAt preferences { hasSeenOnboarding }
    }
}";

fn codes<'a>(data: &'a Value, operation: &str) -> Vec<&'a str> {
    data[operation]["userErrors"]
        .as_array()
        .expect("userErrors")
        .iter()
        .map(|e| e["code"].as_str().expect("code"))
        .collect()
}

fn transport_code(response: &Value) -> Option<&str> {
    response["errors"][0]["extensions"]["code"].as_str()
}

/// One full session — both tokens and the session id.
struct Login {
    access: String,
    refresh: String,
    session: String,
}

async fn log_in_whole(rig: &WireRig, email: &str, password: &str) -> Login {
    let data = rig
        .gql(
            None,
            LOG_IN,
            json!({ "input": { "email": email, "password": password } }),
        )
        .await;
    let auth = &data["logIn"]["auth"];
    Login {
        access: auth["accessToken"].as_str().expect("access").into(),
        refresh: auth["refreshToken"].as_str().expect("refresh").into(),
        session: auth["session"]["id"].as_str().expect("session").into(),
    }
}

async fn refreshes(rig: &WireRig, refresh: &str) -> bool {
    let data = rig
        .gql(
            None,
            REFRESH,
            json!({ "input": { "refreshToken": refresh } }),
        )
        .await;
    !data["refreshSession"]["auth"].is_null()
}

async fn change_password(rig: &WireRig, token: &str, current: &str, new: &str) -> Value {
    rig.gql_raw(
        Some(token),
        CHANGE_PASSWORD,
        json!({ "input": { "currentPassword": current, "newPassword": new } }),
    )
    .await
}

async fn password_changed_at(rig: &WireRig, token: &str) -> DateTime<Utc> {
    let data = rig.gql(Some(token), ME_PASSWORD_AGE, json!({})).await;
    data["me"]["passwordChangedAt"]
        .as_str()
        .expect("passwordChangedAt")
        .parse()
        .expect("timestamp")
}

async fn set_preferences(rig: &WireRig, token: &str, input: Value) -> Value {
    rig.gql(Some(token), SET_PREFERENCES, json!({ "input": input }))
        .await["setPreferences"]
        .clone()
}

async fn preferences(rig: &WireRig, token: &str) -> Value {
    rig.gql(Some(token), ME_PREFERENCES, json!({})).await["me"]["preferences"].clone()
}

const NEW_PASSWORD: &str = "a fresh strong password";

/// A wrong current password refuses on its own field and the stored
/// password stays the one that logs in.
///
/// A wrong current password refuses the change as invalid credentials on that field.
/// ´claim:auth:a-wrong-current-password-refuses-the-change´
#[sqlx::test(migrations = "../../migrations")]
async fn change_password_with_a_wrong_current_password_is_invalid_credentials(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;

    let refused = change_password(&rig, &token, "not the password", NEW_PASSWORD).await;
    assert_eq!(
        codes(&refused["data"], "changePassword"),
        vec!["INVALID_CREDENTIALS"]
    );
    assert_eq!(
        refused["data"]["changePassword"]["userErrors"][0]["field"],
        json!(["currentPassword"])
    );
    assert!(refused["data"]["changePassword"]["ok"].is_null());
    rig.log_in("alice@example.com").await;
}

/// A new password under twelve characters refuses on the new-password
/// field and changes nothing.
///
/// A new password below the floor refuses as a weak password on that field.
/// ´claim:auth:a-short-new-password-refuses-the-change´
#[sqlx::test(migrations = "../../migrations")]
async fn change_password_to_a_short_password_is_weak_password(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;

    let refused = change_password(&rig, &token, MEMBER_PASSWORD, "too short").await;
    assert_eq!(
        codes(&refused["data"], "changePassword"),
        vec!["WEAK_PASSWORD"]
    );
    assert_eq!(
        refused["data"]["changePassword"]["userErrors"][0]["field"],
        json!(["newPassword"])
    );
    rig.log_in("alice@example.com").await;
}

/// A new password the breach corpus knows refuses on the new-password
/// field, and the old one still logs in.
///
/// A new password the breach corpus knows refuses as a weak password on that field.
/// ´claim:auth:a-breached-new-password-refuses-the-change´
#[sqlx::test(migrations = "../../migrations")]
async fn change_password_to_a_breached_password_is_weak_password(pool: PgPool) {
    let rig = breach_rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;

    let refused = change_password(&rig, &token, MEMBER_PASSWORD, BREACHED).await;
    assert_eq!(
        codes(&refused["data"], "changePassword"),
        vec!["WEAK_PASSWORD"]
    );
    assert_eq!(
        refused["data"]["changePassword"]["userErrors"][0]["field"],
        json!(["newPassword"])
    );
    rig.log_in("alice@example.com").await;
}

/// A change revokes every other session and keeps the one that asked:
/// the other device can no longer refresh, this one still can, and the
/// new password is the one that logs in.
///
/// A password change signs out every other device and keeps the one that made it.
/// ´claim:auth:a-password-change-keeps-only-the-asking-session´
#[sqlx::test(migrations = "../../migrations")]
async fn change_password_revokes_other_sessions_and_keeps_this_one(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let here = log_in_whole(&rig, "alice@example.com", MEMBER_PASSWORD).await;
    let elsewhere = log_in_whole(&rig, "alice@example.com", MEMBER_PASSWORD).await;

    let changed = change_password(&rig, &here.access, MEMBER_PASSWORD, NEW_PASSWORD).await;
    assert_eq!(changed["data"]["changePassword"]["ok"], json!(true));
    assert!(!refreshes(&rig, &elsewhere.refresh).await);
    assert!(refreshes(&rig, &here.refresh).await);
    log_in_whole(&rig, "alice@example.com", NEW_PASSWORD).await;
}

/// A run of wrong current passwords backs off: once the run reaches the
/// threshold, the next attempt — even with the right password — is a
/// visible transport-tier RATE_LIMITED, and nothing changes.
///
/// Consecutive wrong current passwords trip the account's re-authentication backoff, visibly.
/// ´claim:auth:wrong-current-passwords-trip-the-reauth-budget´
#[sqlx::test(migrations = "../../migrations")]
async fn repeated_wrong_current_passwords_trip_the_reauth_budget(pool: PgPool) {
    let rig = reauth_rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;

    for _ in 0..3 {
        let refused = change_password(&rig, &token, "not the password", NEW_PASSWORD).await;
        assert_eq!(
            codes(&refused["data"], "changePassword"),
            vec!["INVALID_CREDENTIALS"]
        );
    }
    let blocked = change_password(&rig, &token, MEMBER_PASSWORD, NEW_PASSWORD).await;
    assert_eq!(transport_code(&blocked), Some("RATE_LIMITED"));
    rig.log_in("alice@example.com").await;
}

/// A right current password ends the run: wrong tries below the
/// threshold, then a right one, then the threshold's worth of wrong
/// ones again still answer the password field, not the budget.
///
/// A right current password ends the consecutive-failure run.
/// ´claim:auth:a-right-current-password-ends-the-reauth-run´
#[sqlx::test(migrations = "../../migrations")]
async fn a_right_current_password_ends_the_reauth_run(pool: PgPool) {
    let rig = reauth_rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;

    for _ in 0..2 {
        change_password(&rig, &token, "not the password", NEW_PASSWORD).await;
    }
    let changed = change_password(&rig, &token, MEMBER_PASSWORD, NEW_PASSWORD).await;
    assert_eq!(changed["data"]["changePassword"]["ok"], json!(true));
    for _ in 0..2 {
        let refused = change_password(&rig, &token, "not the password", MEMBER_PASSWORD).await;
        assert_eq!(
            codes(&refused["data"], "changePassword"),
            vec!["INVALID_CREDENTIALS"]
        );
    }
    let again = change_password(&rig, &token, NEW_PASSWORD, MEMBER_PASSWORD).await;
    assert_eq!(again["data"]["changePassword"]["ok"], json!(true));
}

/// The two verbs that re-prove the password inside a session spend one
/// run: wrong passwords split between them trip it for both.
///
/// Every verb that re-proves the password in a live session spends the one re-authentication budget.
/// ´claim:auth:the-reauth-budget-is-one-per-account´
#[sqlx::test(migrations = "../../migrations")]
async fn the_reauth_budget_is_shared_by_change_password_and_request_email_change(pool: PgPool) {
    let rig = reauth_rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;
    let request = |password: &'static str| {
        rig.gql_raw(
            Some(&token),
            REQUEST_EMAIL_CHANGE,
            json!({ "input": { "newEmail": "new@example.com", "currentPassword": password } }),
        )
    };

    let first = request("not the password").await;
    assert_eq!(
        codes(&first["data"], "requestEmailChange"),
        vec!["INVALID_CREDENTIALS"]
    );
    change_password(&rig, &token, "not the password", NEW_PASSWORD).await;
    request("not the password").await;

    assert_eq!(
        transport_code(&request(MEMBER_PASSWORD).await),
        Some("RATE_LIMITED")
    );
    assert_eq!(
        transport_code(&change_password(&rig, &token, MEMBER_PASSWORD, NEW_PASSWORD).await),
        Some("RATE_LIMITED")
    );
    assert_eq!(rig.mailer.count(), 0);
}

/// Another account's run is its own: one account's tripped budget
/// leaves another's change untouched.
///
/// The re-authentication budget is keyed by the account, so one account's run never reaches another.
/// ´claim:auth:the-reauth-budget-is-per-account´
#[sqlx::test(migrations = "../../migrations")]
async fn the_reauth_budget_is_per_account(pool: PgPool) {
    let rig = reauth_rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    rig.seed_member("bob", "bob@example.com").await;
    let alice = rig.log_in("alice@example.com").await;
    let bob = rig.log_in("bob@example.com").await;

    for _ in 0..3 {
        change_password(&rig, &alice, "not the password", NEW_PASSWORD).await;
    }
    let changed = change_password(&rig, &bob, MEMBER_PASSWORD, NEW_PASSWORD).await;
    assert_eq!(changed["data"]["changePassword"]["ok"], json!(true));
}

/// A handle another account holds refuses on the handle field, and the
/// asker keeps its own.
///
/// A handle another account holds refuses the change as taken on that field.
/// ´claim:auth:a-held-handle-refuses-the-change´
#[sqlx::test(migrations = "../../migrations")]
async fn change_handle_to_a_held_handle_is_handle_taken(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    rig.seed_member("bob", "bob@example.com").await;
    let token = rig.log_in("alice@example.com").await;

    let refused = rig
        .gql(
            Some(&token),
            CHANGE_HANDLE,
            json!({ "input": { "handle": "Bob" } }),
        )
        .await;
    assert_eq!(codes(&refused, "changeHandle"), vec!["HANDLE_TAKEN"]);
    assert_eq!(
        refused["changeHandle"]["userErrors"][0]["field"],
        json!(["handle"])
    );
    assert!(refused["changeHandle"]["user"].is_null());
}

/// A handle off the grammar refuses on the handle field.
///
/// A handle off the grammar refuses the change as bad input on that field.
/// ´claim:auth:a-malformed-handle-refuses-the-change´
#[sqlx::test(migrations = "../../migrations")]
async fn change_handle_with_a_malformed_handle_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;

    for handle in ["ab", "has-dash", "a_name_that_runs_past_thirty_chars"] {
        let refused = rig
            .gql(
                Some(&token),
                CHANGE_HANDLE,
                json!({ "input": { "handle": handle } }),
            )
            .await;
        assert_eq!(
            codes(&refused, "changeHandle"),
            vec!["BAD_INPUT"],
            "{handle}"
        );
        assert_eq!(
            refused["changeHandle"]["userErrors"][0]["field"],
            json!(["handle"])
        );
    }
    let free = rig
        .gql(
            Some(&token),
            CHANGE_HANDLE,
            json!({ "input": { "handle": "SolFerreira" } }),
        )
        .await;
    assert_eq!(free["changeHandle"]["user"]["handle"], "solferreira");
}

/// Revoking one session ends exactly that one: it can no longer refresh,
/// the caller and a third session still can, and the list drops it.
///
/// Revoking a session ends that session and no other.
/// ´claim:auth:a-revoke-ends-only-its-session´
#[sqlx::test(migrations = "../../migrations")]
async fn revoke_session_ends_that_session_only(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let here = log_in_whole(&rig, "alice@example.com", MEMBER_PASSWORD).await;
    let gone = log_in_whole(&rig, "alice@example.com", MEMBER_PASSWORD).await;
    let kept = log_in_whole(&rig, "alice@example.com", MEMBER_PASSWORD).await;

    let revoked = rig
        .gql(
            Some(&here.access),
            REVOKE_SESSION,
            json!({ "input": { "session": gone.session } }),
        )
        .await;
    assert_eq!(codes(&revoked, "revokeSession"), Vec::<&str>::new());
    assert!(!refreshes(&rig, &gone.refresh).await);
    assert!(refreshes(&rig, &kept.refresh).await);

    let listed = rig.gql(Some(&here.access), ME_SESSIONS, json!({})).await;
    let ids: Vec<&str> = listed["me"]["sessions"]
        .as_array()
        .expect("sessions")
        .iter()
        .map(|s| s["id"].as_str().expect("id"))
        .collect();
    assert!(!ids.contains(&gone.session.as_str()));
    assert!(ids.contains(&here.session.as_str()));

    let unknown = rig
        .gql(
            Some(&here.access),
            REVOKE_SESSION,
            json!({ "input": { "session": Uuid::new_v4() } }),
        )
        .await;
    assert_eq!(codes(&unknown, "revokeSession"), vec!["NOT_FOUND"]);
}

/// Signing out everywhere else keeps the caller's session and ends every
/// other one.
///
/// Signing out everywhere else ends every session but the caller's.
/// ´claim:auth:revoke-others-keeps-the-caller´
#[sqlx::test(migrations = "../../migrations")]
async fn revoke_other_sessions_keeps_the_caller(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let here = log_in_whole(&rig, "alice@example.com", MEMBER_PASSWORD).await;
    let a = log_in_whole(&rig, "alice@example.com", MEMBER_PASSWORD).await;
    let b = log_in_whole(&rig, "alice@example.com", MEMBER_PASSWORD).await;

    let revoked = rig.gql(Some(&here.access), REVOKE_OTHERS, json!({})).await;
    assert_eq!(revoked["revokeOtherSessions"]["revokedCount"], json!(2));
    assert!(!refreshes(&rig, &a.refresh).await);
    assert!(!refreshes(&rig, &b.refresh).await);
    assert!(refreshes(&rig, &here.refresh).await);
}

/// The age moves forward on a change and again on a reset, each to the
/// moment the password was set.
///
/// The password's age is restamped by every change and every reset.
/// ´claim:auth:a-password-set-stamps-its-age´
#[sqlx::test(migrations = "../../migrations")]
async fn password_changed_at_is_stamped_by_change_and_reset(pool: PgPool) {
    let rig = rig(pool);
    let (user, _) = rig.seed_member("alice", "alice@example.com").await;
    sqlx::query(
        "UPDATE user_credentials SET password_changed_at = NOW() - INTERVAL '30 days'
         WHERE actor_id = $1",
    )
    .bind(user)
    .execute(&rig.pool)
    .await
    .expect("backdates");
    let token = rig.log_in("alice@example.com").await;
    let registered = password_changed_at(&rig, &token).await;

    let before_change = Utc::now() - chrono::Duration::seconds(5);
    change_password(&rig, &token, MEMBER_PASSWORD, NEW_PASSWORD).await;
    let changed = password_changed_at(&rig, &token).await;
    assert!(changed > registered);
    assert!(changed >= before_change);

    rig.gql(
        None,
        "mutation($input: RequestPasswordResetInput!) { requestPasswordReset(input: $input) { ok } }",
        json!({ "input": { "email": "alice@example.com" } }),
    )
    .await;
    sqlx::query(
        "UPDATE user_credentials SET password_changed_at = NOW() - INTERVAL '1 day'
         WHERE actor_id = $1",
    )
    .bind(user)
    .execute(&rig.pool)
    .await
    .expect("backdates");
    let reset_token = rig.mailer.latest_token_for("alice@example.com");
    let reset = rig
        .gql(
            None,
            "mutation($input: ConfirmPasswordResetInput!) {
               confirmPasswordReset(input: $input) { ok userErrors { code } }
             }",
            json!({ "input": { "resetToken": reset_token, "newPassword": MEMBER_PASSWORD } }),
        )
        .await;
    assert_eq!(reset["confirmPasswordReset"]["ok"], json!(true));
    let fresh = rig.log_in("alice@example.com").await;
    assert!(password_changed_at(&rig, &fresh).await >= before_change);
}

/// A password never changed reads the moment the account was made —
/// when it was last set.
///
/// A password never changed reads its age from registration.
/// ´claim:auth:an-unchanged-password-ages-from-registration´
#[sqlx::test(migrations = "../../migrations")]
async fn password_changed_at_backfills_from_registration(pool: PgPool) {
    let rig = rig(pool);
    let (user, _) = rig.seed_member("alice", "alice@example.com").await;
    let created: DateTime<Utc> =
        sqlx::query_scalar("SELECT created_at FROM user_credentials WHERE actor_id = $1")
            .bind(user)
            .fetch_one(&rig.pool)
            .await
            .expect("created_at");
    let token = rig.log_in("alice@example.com").await;
    let age = password_changed_at(&rig, &token).await;
    assert!((age - created).num_seconds().abs() <= 1);
}

/// Another viewer reads no password age and no preferences for an
/// account that is not theirs.
///
/// The password's age and the preferences resolve only for the account's own viewer.
/// ´claim:auth:settings-reads-are-viewer-only´
#[sqlx::test(migrations = "../../migrations")]
async fn password_changed_at_is_viewer_only(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    rig.seed_member("bob", "bob@example.com").await;
    let bob = rig.log_in("bob@example.com").await;

    for token in [Some(bob.as_str()), None] {
        let read = rig
            .gql(token, USER_BY_HANDLE, json!({ "handle": "alice" }))
            .await;
        assert!(read["user"]["passwordChangedAt"].is_null());
        assert!(read["user"]["preferences"].is_null());
    }
}

/// A default license saves and `me` reads it back; an account that never
/// set one reads null (public domain) and has not seen the intro.
///
/// The default license saves and reads back on the account.
/// ´claim:preferences:the-default-license-round-trips´
#[sqlx::test(migrations = "../../migrations")]
async fn set_preferences_saves_the_default_license_and_me_reads_it(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;

    let fresh = preferences(&rig, &token).await;
    assert!(fresh["defaultLicense"].is_null());
    assert_eq!(fresh["hasSeenOnboarding"], json!(false));

    let saved = set_preferences(
        &rig,
        &token,
        json!({ "defaultLicense": { "attribution": 1.0, "provenance": 0.5 } }),
    )
    .await;
    assert_eq!(codes(&json!({ "p": saved }), "p"), Vec::<&str>::new());
    assert_eq!(
        saved["preferences"]["defaultLicense"],
        json!({ "attribution": 1.0, "provenance": 0.5 })
    );
    assert_eq!(
        preferences(&rig, &token).await["defaultLicense"],
        json!({ "attribution": 1.0, "provenance": 0.5 })
    );
}

/// An explicit null restores public domain.
///
/// An explicit null restores the default license.
/// ´claim:preferences:null-restores-public-domain´
#[sqlx::test(migrations = "../../migrations")]
async fn set_preferences_null_restores_public_domain(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;

    set_preferences(
        &rig,
        &token,
        json!({ "defaultLicense": { "attribution": 0.5, "provenance": 1.0 } }),
    )
    .await;
    let restored = set_preferences(&rig, &token, json!({ "defaultLicense": null })).await;
    assert!(restored["preferences"]["defaultLicense"].is_null());
    assert!(preferences(&rig, &token).await["defaultLicense"].is_null());
}

/// A field absent from the input is left as it is: setting the intro flag
/// keeps the license, and setting the license keeps the flag.
///
/// An absent field is left as it is.
/// ´claim:preferences:an-absent-field-is-kept´
#[sqlx::test(migrations = "../../migrations")]
async fn set_preferences_absent_field_is_left_as_it_is(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;

    set_preferences(
        &rig,
        &token,
        json!({ "defaultLicense": { "attribution": 1.0, "provenance": 1.0 } }),
    )
    .await;
    let flagged = set_preferences(&rig, &token, json!({ "hasSeenOnboarding": true })).await;
    assert_eq!(flagged["preferences"]["hasSeenOnboarding"], json!(true));
    assert_eq!(
        flagged["preferences"]["defaultLicense"],
        json!({ "attribution": 1.0, "provenance": 1.0 })
    );
    let relicensed = set_preferences(
        &rig,
        &token,
        json!({ "defaultLicense": { "attribution": 0.0, "provenance": 0.5 } }),
    )
    .await;
    assert_eq!(relicensed["preferences"]["hasSeenOnboarding"], json!(true));
    assert_eq!(
        relicensed["preferences"]["contentFilteringSeverityLevel"],
        Value::Null
    );
}

/// An axis off the three published readings refuses as BAD_INPUT on that
/// axis and writes nothing; so does a filter level outside 0–10.
///
/// A license axis off the three readings, or a filter level off 0 to 10, refuses as bad input and writes nothing.
/// ´claim:preferences:off-ladder-values-are-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn set_preferences_off_ladder_axis_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;

    let off = set_preferences(
        &rig,
        &token,
        json!({ "defaultLicense": { "attribution": 0.25, "provenance": 0.0 } }),
    )
    .await;
    assert_eq!(codes(&json!({ "p": off }), "p"), vec!["BAD_INPUT"]);
    assert_eq!(
        off["userErrors"][0]["field"],
        json!(["defaultLicense", "attribution"])
    );
    assert!(off["preferences"].is_null());
    let off_provenance = set_preferences(
        &rig,
        &token,
        json!({ "defaultLicense": { "attribution": 0.0, "provenance": 2.0 } }),
    )
    .await;
    assert_eq!(
        off_provenance["userErrors"][0]["field"],
        json!(["defaultLicense", "provenance"])
    );
    let level = set_preferences(
        &rig,
        &token,
        json!({ "contentFilteringSeverityLevel": 11, "hasSeenOnboarding": true }),
    )
    .await;
    assert_eq!(
        level["userErrors"][0]["field"],
        json!(["contentFilteringSeverityLevel"])
    );
    let stored = preferences(&rig, &token).await;
    assert!(stored["defaultLicense"].is_null());
    assert_eq!(stored["hasSeenOnboarding"], json!(false));
}

/// The has-seen-the-intro flag reads back once written and restores to
/// false on null — one per account, whichever device set it.
///
/// The has-seen-the-intro flag saves on the account and null restores it to unseen.
/// ´claim:preferences:the-intro-flag-round-trips´
#[sqlx::test(migrations = "../../migrations")]
async fn set_preferences_has_seen_onboarding_reads_back(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let phone = rig.log_in("alice@example.com").await;
    let browser = rig.log_in("alice@example.com").await;

    set_preferences(&rig, &phone, json!({ "hasSeenOnboarding": true })).await;
    assert_eq!(
        preferences(&rig, &browser).await["hasSeenOnboarding"],
        json!(true)
    );
    set_preferences(&rig, &browser, json!({ "hasSeenOnboarding": null })).await;
    assert_eq!(
        preferences(&rig, &phone).await["hasSeenOnboarding"],
        json!(false)
    );
}

/// Preferences are viewer-only, and writing them needs a session.
///
/// Writing preferences needs a session; reading them resolves only for the account's own viewer.
/// ´claim:preferences:preferences-are-viewer-only´
#[sqlx::test(migrations = "../../migrations")]
async fn preferences_are_viewer_only(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("alice", "alice@example.com").await;
    let alice = rig.log_in("alice@example.com").await;
    set_preferences(&rig, &alice, json!({ "hasSeenOnboarding": true })).await;

    let anonymous = rig
        .gql_raw(
            None,
            SET_PREFERENCES,
            json!({ "input": { "hasSeenOnboarding": true } }),
        )
        .await;
    assert_eq!(transport_code(&anonymous), Some("UNAUTHENTICATED"));

    rig.seed_member("bob", "bob@example.com").await;
    let bob = rig.log_in("bob@example.com").await;
    let read = rig
        .gql(Some(&bob), USER_BY_HANDLE, json!({ "handle": "alice" }))
        .await;
    assert!(read["user"]["preferences"].is_null());
}
