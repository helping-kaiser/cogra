//! Auth-endpoint rate limiting (auth.md "Rate limiting"): every limited
//! verb's budget, the login backoff's arm/block/clear cycle, the
//! enumeration-silence of the email-keyed budgets, and the store-level
//! window/backoff/sweep semantics. Requires a live Postgres (`make up`).
//!
//! The rig derives the client IP from `X-Real-Ip` so each request names
//! its own address — varying the socket peer is impossible through
//! `oneshot`.

use std::sync::Arc;

use axum::body::Body;
use axum::http::Request;
use chrono::Utc;
use http_body_util::BodyExt;
use postgres_store::{PgPool, auth as store, rate_limit};
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid::Uuid;

use api::ratelimit::{RateLimitConfig, Window};

mod rig;
use rig::TestMailer;

struct Rig {
    app: axum::Router,
    pool: PgPool,
    mailer: Arc<TestMailer>,
}

impl Rig {
    fn new(pool: PgPool, rate_limits: RateLimitConfig) -> Self {
        let mailer = Arc::new(TestMailer::default());
        Self {
            app: rig::x_real_ip_app(pool.clone(), mailer.clone(), rate_limits),
            pool,
            mailer,
        }
    }

    /// One GraphQL request from the given client IP; returns the whole
    /// body, transport errors included.
    async fn gql(&self, ip: &str, query: &str, variables: Value) -> Value {
        let body = json!({ "query": query, "variables": variables }).to_string();
        let request = Request::builder()
            .method("POST")
            .uri("/graphql")
            .header("content-type", "application/json")
            .header("x-real-ip", ip)
            .body(Body::from(body))
            .expect("request");
        let response = self.app.clone().oneshot(request).await.expect("response");
        let bytes = response
            .into_body()
            .collect()
            .await
            .expect("body")
            .to_bytes();
        serde_json::from_slice(&bytes).expect("json")
    }

    /// A credentialed account with a real Argon2 hash, ready to log in.
    async fn seed_user(&self, handle: &str, email: &str, password: &str) -> Uuid {
        let key = common::l1::client::ActorKey::generate();
        let id = Uuid::new_v4();
        let mut conn = self.pool.acquire().await.expect("conn");
        postgres_store::genesis::insert_actor(
            &mut conn,
            id,
            "user",
            handle,
            &key.public_key_bytes(),
            &key.address(),
        )
        .await
        .expect("actor");
        drop(conn);
        let hash = api::auth::hash_password(password).expect("hash");
        postgres_store::genesis::insert_credentials(&self.pool, id, email, &hash)
            .await
            .expect("credentials");
        id
    }

    /// An invite link from a freshly seeded inviter.
    async fn invite_link(&self) -> Uuid {
        let inviter = self
            .seed_user("inviter", "inviter@example.com", "inviter password")
            .await;
        store::create_invite_link(
            &self.pool,
            Uuid::new_v4(),
            inviter,
            0.1,
            0.1,
            false,
            Utc::now() + chrono::Duration::days(1),
        )
        .await
        .expect("link")
        .id
    }
}

fn transport_code(json: &Value) -> Option<&str> {
    json["errors"][0]["extensions"]["code"].as_str()
}

fn user_error_code<'a>(json: &'a Value, operation: &str) -> Option<&'a str> {
    json["data"][operation]["userErrors"][0]["code"].as_str()
}

const LOG_IN: &str = "mutation($input: LogInInput!) {
    logIn(input: $input) { auth { accessToken refreshToken } userErrors { code } }
}";
const REGISTER: &str = "mutation($input: RegisterInput!) {
    register(input: $input) { auth { accessToken } userErrors { code } }
}";
const APPLY: &str = "mutation($input: ApplyWithInviteInput!) {
    applyWithInvite(input: $input) { application { id } userErrors { code } }
}";
const REQUEST_RESET: &str = "mutation($input: RequestPasswordResetInput!) {
    requestPasswordReset(input: $input) { ok }
}";
const RESEND: &str = "mutation($input: ResendVerificationEmailInput!) {
    resendVerificationEmail(input: $input) { ok }
}";
const VERIFY_EMAIL: &str = "mutation($input: VerifyEmailInput!) {
    verifyEmail(input: $input) { ok userErrors { code } }
}";
const CONFIRM_RESET: &str = "mutation($input: ConfirmPasswordResetInput!) {
    confirmPasswordReset(input: $input) { ok userErrors { code } }
}";

fn login_vars(email: &str, password: &str) -> Value {
    json!({ "input": { "email": email, "password": password } })
}

/// The per-IP window is keyed by IP alone, so tripping it on one address
/// leaves another getting the ordinary refusal.
#[sqlx::test(migrations = "../../migrations")]
async fn login_per_ip_window_trips_and_leaves_other_ips_alone(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.login_ip = Window {
        limit: 3,
        window_secs: 3600.0,
    };
    let rig = Rig::new(pool, limits);

    for _ in 0..3 {
        let json = rig
            .gql(
                "10.0.0.1",
                LOG_IN,
                login_vars("nobody@example.com", "wrong password!"),
            )
            .await;
        assert_eq!(transport_code(&json), None, "within budget: {json}");
        assert_eq!(user_error_code(&json, "logIn"), Some("INVALID_CREDENTIALS"));
    }
    let json = rig
        .gql(
            "10.0.0.1",
            LOG_IN,
            login_vars("nobody@example.com", "wrong password!"),
        )
        .await;
    assert_eq!(transport_code(&json), Some("RATE_LIMITED"), "{json}");

    let json = rig
        .gql(
            "10.0.0.2",
            LOG_IN,
            login_vars("nobody@example.com", "wrong password!"),
        )
        .await;
    assert_eq!(transport_code(&json), None, "{json}");
    assert_eq!(user_error_code(&json, "logIn"), Some("INVALID_CREDENTIALS"));
}

/// The backoff is keyed by email alone, so attempts come from distinct
/// IPs here. Once it bites, even the correct password is refused at the
/// gate, and another account is untouched.
#[sqlx::test(migrations = "../../migrations")]
async fn login_backoff_blocks_after_consecutive_failures(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.login_backoff_threshold = 2;
    limits.login_backoff_base_secs = 60.0;
    limits.login_backoff_cap_secs = 60.0;
    let rig = Rig::new(pool, limits);
    rig.seed_user("victim", "victim@example.com", "the real password")
        .await;

    for ip in ["10.0.1.1", "10.0.1.2"] {
        let json = rig
            .gql(
                ip,
                LOG_IN,
                login_vars("victim@example.com", "wrong password!"),
            )
            .await;
        assert_eq!(user_error_code(&json, "logIn"), Some("INVALID_CREDENTIALS"));
    }
    let json = rig
        .gql(
            "10.0.1.3",
            LOG_IN,
            login_vars("victim@example.com", "the real password"),
        )
        .await;
    assert_eq!(transport_code(&json), Some("RATE_LIMITED"), "{json}");

    let json = rig
        .gql(
            "10.0.1.4",
            LOG_IN,
            login_vars("other@example.com", "wrong password!"),
        )
        .await;
    assert_eq!(transport_code(&json), None, "{json}");
}

/// The backoff must not become an account-existence oracle: an email with
/// no account behind it blocks after the same consecutive failures, with
/// the same refusal.
#[sqlx::test(migrations = "../../migrations")]
async fn login_backoff_arms_for_unknown_accounts_identically(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.login_backoff_threshold = 2;
    limits.login_backoff_base_secs = 60.0;
    limits.login_backoff_cap_secs = 60.0;
    let rig = Rig::new(pool, limits);

    for _ in 0..2 {
        let json = rig
            .gql(
                "10.0.2.1",
                LOG_IN,
                login_vars("ghost@example.com", "wrong password!"),
            )
            .await;
        assert_eq!(user_error_code(&json, "logIn"), Some("INVALID_CREDENTIALS"));
    }
    let json = rig
        .gql(
            "10.0.2.1",
            LOG_IN,
            login_vars("ghost@example.com", "wrong password!"),
        )
        .await;
    assert_eq!(transport_code(&json), Some("RATE_LIMITED"), "{json}");
}

/// A success restarts the run, so two further failures are again below
/// the threshold and the correct password still works.
#[sqlx::test(migrations = "../../migrations")]
async fn a_successful_login_clears_the_consecutive_run(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.login_backoff_threshold = 3;
    limits.login_backoff_base_secs = 60.0;
    limits.login_backoff_cap_secs = 60.0;
    let rig = Rig::new(pool, limits);
    rig.seed_user("owner", "owner@example.com", "the real password")
        .await;

    for _ in 0..2 {
        rig.gql(
            "10.0.3.1",
            LOG_IN,
            login_vars("owner@example.com", "wrong password!"),
        )
        .await;
    }
    let json = rig
        .gql(
            "10.0.3.1",
            LOG_IN,
            login_vars("owner@example.com", "the real password"),
        )
        .await;
    assert!(
        json["data"]["logIn"]["auth"]["accessToken"].is_string(),
        "the correct password logs in below the threshold: {json}"
    );

    for _ in 0..2 {
        rig.gql(
            "10.0.3.1",
            LOG_IN,
            login_vars("owner@example.com", "wrong password!"),
        )
        .await;
    }
    let json = rig
        .gql(
            "10.0.3.1",
            LOG_IN,
            login_vars("owner@example.com", "the real password"),
        )
        .await;
    assert!(
        json["data"]["logIn"]["auth"]["accessToken"].is_string(),
        "cleared runs do not accumulate: {json}"
    );
}


fn register_vars(link: Uuid, n: u32) -> Value {
    json!({ "input": {
        "inviteLink": link,
        "handle": format!("applicant_{n}"),
        "email": format!("applicant{n}@example.com"),
        "password": "a strong password",
    }})
}

/// The two budgets are checked in order. Two submits fill the first IP's
/// budget and the third trips it before the link budget is even
/// consulted; a second IP passes its own budget, but the link's third
/// slot was the last, so the fourth counted submit trips the per-link
/// budget.
#[sqlx::test(migrations = "../../migrations")]
async fn register_budgets_per_ip_and_per_link(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.register_ip = Window {
        limit: 2,
        window_secs: 3600.0,
    };
    limits.register_link = Window {
        limit: 3,
        window_secs: 3600.0,
    };
    let rig = Rig::new(pool, limits);
    let link = rig.invite_link().await;

    for n in 0..2 {
        let json = rig.gql("10.1.0.1", REGISTER, register_vars(link, n)).await;
        assert_eq!(transport_code(&json), None, "{json}");
        assert!(json["data"]["register"]["auth"]["accessToken"].is_string());
    }
    let json = rig.gql("10.1.0.1", REGISTER, register_vars(link, 2)).await;
    assert_eq!(transport_code(&json), Some("RATE_LIMITED"), "{json}");

    let json = rig.gql("10.1.0.2", REGISTER, register_vars(link, 3)).await;
    assert_eq!(transport_code(&json), None, "{json}");
    let json = rig.gql("10.1.0.2", REGISTER, register_vars(link, 4)).await;
    assert_eq!(transport_code(&json), Some("RATE_LIMITED"), "{json}");
}

/// A re-arm is an application submit, so the same IP budget refuses it
/// before any flow logic runs.
#[sqlx::test(migrations = "../../migrations")]
async fn apply_with_invite_spends_the_register_budget(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.register_ip = Window {
        limit: 1,
        window_secs: 3600.0,
    };
    let rig = Rig::new(pool, limits);
    let link = rig.invite_link().await;

    let json = rig.gql("10.1.1.1", REGISTER, register_vars(link, 0)).await;
    let token = json["data"]["register"]["auth"]["accessToken"]
        .as_str()
        .expect("session")
        .to_string();

    let body = json!({
        "query": APPLY,
        "variables": { "input": { "inviteLink": link } },
    })
    .to_string();
    let request = Request::builder()
        .method("POST")
        .uri("/graphql")
        .header("content-type", "application/json")
        .header("x-real-ip", "10.1.1.1")
        .header("authorization", format!("Bearer {token}"))
        .body(Body::from(body))
        .expect("request");
    let response = rig.app.clone().oneshot(request).await.expect("response");
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("body")
        .to_bytes();
    let json: Value = serde_json::from_slice(&bytes).expect("json");
    assert_eq!(transport_code(&json), Some("RATE_LIMITED"), "{json}");
}


/// The tripped per-email budget answers the same `ok: true` and just
/// stops mailing — no visible difference to enumerate with.
#[sqlx::test(migrations = "../../migrations")]
async fn reset_requests_trip_the_email_budget_silently(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.reset_email = Window {
        limit: 2,
        window_secs: 3600.0,
    };
    let rig = Rig::new(pool, limits);
    rig.seed_user("target", "target@example.com", "the real password")
        .await;

    for _ in 0..2 {
        let json = rig
            .gql(
                "10.2.0.1",
                REQUEST_RESET,
                json!({ "input": { "email": "target@example.com" } }),
            )
            .await;
        assert_eq!(json["data"]["requestPasswordReset"]["ok"], true);
    }
    assert_eq!(rig.mailer.count(), 2, "both requests mailed");

    let json = rig
        .gql(
            "10.2.0.1",
            REQUEST_RESET,
            json!({ "input": { "email": "target@example.com" } }),
        )
        .await;
    assert_eq!(transport_code(&json), None, "{json}");
    assert_eq!(json["data"]["requestPasswordReset"]["ok"], true);
    assert_eq!(rig.mailer.count(), 2, "the third request sent nothing");
}

/// An unknown address spends budget and trips exactly like a known one,
/// with the same payload before and after the trip.
#[sqlx::test(migrations = "../../migrations")]
async fn reset_requests_for_unknown_emails_are_indistinguishable(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.reset_email = Window {
        limit: 2,
        window_secs: 3600.0,
    };
    let rig = Rig::new(pool, limits);

    for _ in 0..3 {
        let json = rig
            .gql(
                "10.2.1.1",
                REQUEST_RESET,
                json!({ "input": { "email": "ghost@example.com" } }),
            )
            .await;
        assert_eq!(transport_code(&json), None, "{json}");
        assert_eq!(json["data"]["requestPasswordReset"]["ok"], true);
    }
    assert_eq!(rig.mailer.count(), 0);
}

/// The per-IP budget is the visible half of the pair: tripping it refuses
/// outright rather than answering `ok: true`.
#[sqlx::test(migrations = "../../migrations")]
async fn reset_requests_trip_the_ip_budget_visibly(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.reset_ip = Window {
        limit: 2,
        window_secs: 3600.0,
    };
    let rig = Rig::new(pool, limits);

    for n in 0..2 {
        let json = rig
            .gql(
                "10.2.2.1",
                REQUEST_RESET,
                json!({ "input": { "email": format!("anyone{n}@example.com") } }),
            )
            .await;
        assert_eq!(transport_code(&json), None, "{json}");
    }
    let json = rig
        .gql(
            "10.2.2.1",
            REQUEST_RESET,
            json!({ "input": { "email": "anyone9@example.com" } }),
        )
        .await;
    assert_eq!(transport_code(&json), Some("RATE_LIMITED"), "{json}");
}

/// Resends trip the same way: same `ok`, no mail, and an unknown email
/// answers identically.
#[sqlx::test(migrations = "../../migrations")]
async fn resends_trip_the_email_budget_silently(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.resend_email = Window {
        limit: 1,
        window_secs: 3600.0,
    };
    let rig = Rig::new(pool, limits);
    let link = rig.invite_link().await;
    rig.gql("10.3.0.1", REGISTER, register_vars(link, 0)).await;
    let mailed_at_registration = rig.mailer.count();

    let json = rig
        .gql(
            "10.3.0.2",
            RESEND,
            json!({ "input": { "email": "applicant0@example.com" } }),
        )
        .await;
    assert_eq!(json["data"]["resendVerificationEmail"]["ok"], true);
    assert_eq!(rig.mailer.count(), mailed_at_registration + 1);

    let json = rig
        .gql(
            "10.3.0.2",
            RESEND,
            json!({ "input": { "email": "applicant0@example.com" } }),
        )
        .await;
    assert_eq!(transport_code(&json), None, "{json}");
    assert_eq!(json["data"]["resendVerificationEmail"]["ok"], true);
    assert_eq!(rig.mailer.count(), mailed_at_registration + 1);
    let json = rig
        .gql(
            "10.3.0.2",
            RESEND,
            json!({ "input": { "email": "ghost@example.com" } }),
        )
        .await;
    assert_eq!(json["data"]["resendVerificationEmail"]["ok"], true);
}

/// The confirmation verbs share one per-IP budget, so two guesses through
/// `verifyEmail` spend it and the third is refused even through a
/// different verb.
#[sqlx::test(migrations = "../../migrations")]
async fn token_confirmations_share_one_ip_budget(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.confirm_ip = Window {
        limit: 2,
        window_secs: 3600.0,
    };
    let rig = Rig::new(pool, limits);

    for _ in 0..2 {
        let json = rig
            .gql(
                "10.4.0.1",
                VERIFY_EMAIL,
                json!({ "input": { "verificationToken": "guess" } }),
            )
            .await;
        assert_eq!(transport_code(&json), None, "{json}");
        assert_eq!(
            user_error_code(&json, "verifyEmail"),
            Some("VERIFICATION_TOKEN_INVALID")
        );
    }
    let json = rig
        .gql(
            "10.4.0.1",
            CONFIRM_RESET,
            json!({ "input": { "resetToken": "guess", "newPassword": "a strong password" } }),
        )
        .await;
    assert_eq!(transport_code(&json), Some("RATE_LIMITED"), "{json}");
}

/// A window counts attempts and resets when it expires. A zero-length
/// window has always just expired, so every attempt is the first of a
/// fresh one.
#[sqlx::test(migrations = "../../migrations")]
async fn windows_count_and_reset(pool: PgPool) {
    for expected in 1..=3 {
        let count = rate_limit::count_in_window(&pool, "test", "key", 3600.0)
            .await
            .expect("count");
        assert_eq!(count, expected);
    }
    for _ in 0..2 {
        let count = rate_limit::count_in_window(&pool, "test", "expired", 0.0)
            .await
            .expect("count");
        assert_eq!(count, 1);
    }
}

/// The delay arms at the threshold and doubles from there, under a cap:
/// the 3rd failure yields 2.0 × 2⁰ = 2s, the 4th 2.0 × 2¹ = 4s, and the
/// 5th would be 8s but caps at 5s.
#[sqlx::test(migrations = "../../migrations")]
async fn the_backoff_arms_at_the_threshold_doubles_and_caps(pool: PgPool) {
    let blocked = || rate_limit::blocked_until(&pool, "b", "k");
    let fail = || rate_limit::record_failure(&pool, "b", "k", 3, 2.0, 5.0);

    assert_eq!(fail().await.expect("1st"), 1);
    assert_eq!(fail().await.expect("2nd"), 2);
    assert_eq!(blocked().await.expect("query"), None, "below the threshold");

    assert_eq!(fail().await.expect("3rd"), 3);
    let until = blocked().await.expect("query").expect("blocked");
    let delay = (until - Utc::now()).num_milliseconds();
    assert!((500..=2500).contains(&delay), "≈2s, got {delay}ms");

    rate_limit::record_failure(&pool, "b", "k", 3, 2.0, 5.0)
        .await
        .expect("4th");
    rate_limit::record_failure(&pool, "b", "k", 3, 2.0, 5.0)
        .await
        .expect("5th");
    let until = blocked().await.expect("query").expect("blocked");
    let delay = (until - Utc::now()).num_milliseconds();
    assert!(delay <= 5500, "capped at 5s, got {delay}ms");

    rate_limit::clear(&pool, "b", "k").await.expect("clear");
    assert_eq!(blocked().await.expect("query"), None, "cleared");
    assert_eq!(fail().await.expect("fresh"), 1, "the run restarted");
}

/// An armed, still-blocking row has to survive any sweep. With a zero
/// idle bound every settled row is stale, so that blocking row is the
/// only one left standing.
#[sqlx::test(migrations = "../../migrations")]
async fn the_sweep_removes_idle_rows_and_keeps_blocking_ones(pool: PgPool) {
    rate_limit::count_in_window(&pool, "sweep", "idle", 3600.0)
        .await
        .expect("row");
    for _ in 0..2 {
        rate_limit::record_failure(&pool, "sweep", "blocking", 1, 3600.0, 3600.0)
            .await
            .expect("failure");
    }
    tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    let removed = rate_limit::sweep_idle(&pool, 0.0).await.expect("sweep");
    assert_eq!(removed, 1, "the idle row went");
    assert!(
        rate_limit::blocked_until(&pool, "sweep", "blocking")
            .await
            .expect("query")
            .is_some(),
        "the blocking row survived the sweep"
    );
}
