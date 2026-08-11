//! The refresh-token-reuse security notice (auth.md "Reuse detection"):
//! logIn's reuseDetectedAt carrier — null before detection, the
//! detection time exactly once on the first successful login after it,
//! never on a refusal — and the collapsed REFRESH_TOKEN_INVALID code at
//! refresh time. Requires a live Postgres (`make up`).

use std::sync::Arc;

use axum::body::Body;
use axum::http::Request;
use axum_client_ip::ClientIpSource;
use http_body_util::BodyExt;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::PgPool;
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid::Uuid;

use api::ratelimit::RateLimitConfig;

struct SilentMailer;

impl api::mailer::Mailer for SilentMailer {
    fn send(
        &self,
        _mail: api::mailer::Mail,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + '_>> {
        Box::pin(async {})
    }
}

struct Rig {
    app: axum::Router,
    pool: PgPool,
}

impl Rig {
    fn new(pool: PgPool) -> Self {
        let standin = StandIn::new(pool.clone(), StandInConfig::default());
        let auth = api::auth::AuthConfig::ephemeral().expect("auth config");
        let schema = api::schema::build(api::schema::ApiContext {
            pool: pool.clone(),
            boundary: api::l1::StandInBoundary(standin.clone()),
            funding: standin,
            auth: auth.clone(),
            mailer: Arc::new(SilentMailer),
            web_origin: api::mailer::WebOrigin("http://localhost:3000".into()),
            onboarding: api::onboarding::OnboardingConfig::default(),
            rate_limits: RateLimitConfig::default(),
            breach: Arc::new(api::breach::DisabledCorpus),
        });
        Self {
            app: api::app(schema, auth, ClientIpSource::XRealIp),
            pool,
        }
    }

    async fn gql(&self, query: &str, variables: Value) -> Value {
        let body = json!({ "query": query, "variables": variables }).to_string();
        let request = Request::builder()
            .method("POST")
            .uri("/graphql")
            .header("content-type", "application/json")
            .header("x-real-ip", "203.0.113.1")
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

    async fn log_in(&self, email: &str, password: &str) -> Value {
        self.gql(
            LOG_IN,
            json!({ "input": { "email": email, "password": password } }),
        )
        .await
    }
}

const LOG_IN: &str = "mutation($input: LogInInput!) {
    logIn(input: $input) {
        auth { refreshToken }
        reuseDetectedAt
        userErrors { code }
    }
}";
const REFRESH: &str = "mutation($input: RefreshSessionInput!) {
    refreshSession(input: $input) { auth { refreshToken } userErrors { code } }
}";

/// Rotates once and re-presents the consumed token past the grace
/// window, arming the reuse-detection mark; asserts the collapsed
/// refresh-time code.
async fn detect_reuse(rig: &Rig, refresh_token: &str) {
    let rotated = rig
        .gql(
            REFRESH,
            json!({ "input": { "refreshToken": refresh_token } }),
        )
        .await;
    assert!(rotated["data"]["refreshSession"]["auth"]["refreshToken"].is_string());
    // Shift the rotation behind the grace window: an immediate replay
    // would be answered idempotently, not read as theft.
    let hash = api::auth::hash_of(refresh_token);
    sqlx::query(
        "UPDATE auth_refresh_tokens
         SET revoked_at = revoked_at - INTERVAL '11 seconds' WHERE token_hash = $1",
    )
    .bind(&hash[..])
    .execute(&rig.pool)
    .await
    .expect("backdate");
    let reused = rig
        .gql(
            REFRESH,
            json!({ "input": { "refreshToken": refresh_token } }),
        )
        .await;
    // Reuse and plain-invalid share one code: the presenter — possibly
    // the thief — is never told detection fired.
    assert_eq!(
        reused["data"]["refreshSession"]["userErrors"][0]["code"],
        "REFRESH_TOKEN_INVALID"
    );
    assert!(reused["data"]["refreshSession"]["auth"].is_null());
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_notice_rides_the_first_login_after_detection(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_user("alice", "a@example.com", "a strong password")
        .await;

    // Before any detection the carrier is null.
    let clean = rig.log_in("a@example.com", "a strong password").await;
    assert!(clean["data"]["logIn"]["reuseDetectedAt"].is_null());
    let refresh_token = clean["data"]["logIn"]["auth"]["refreshToken"]
        .as_str()
        .expect("token")
        .to_owned();

    detect_reuse(&rig, &refresh_token).await;

    // The first login after detection carries the timestamp; the next
    // one is clean again — delivered exactly once.
    let notified = rig.log_in("a@example.com", "a strong password").await;
    assert!(notified["data"]["logIn"]["reuseDetectedAt"].is_string());
    let after = rig.log_in("a@example.com", "a strong password").await;
    assert!(after["data"]["logIn"]["reuseDetectedAt"].is_null());
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_refusal_never_carries_or_clears_the_notice(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_user("alice", "a@example.com", "a strong password")
        .await;
    let clean = rig.log_in("a@example.com", "a strong password").await;
    let refresh_token = clean["data"]["logIn"]["auth"]["refreshToken"]
        .as_str()
        .expect("token")
        .to_owned();

    detect_reuse(&rig, &refresh_token).await;

    // A wrong password neither leaks the pending mark nor consumes it.
    let refused = rig.log_in("a@example.com", "wrong password").await;
    assert_eq!(
        refused["data"]["logIn"]["userErrors"][0]["code"],
        "INVALID_CREDENTIALS"
    );
    assert!(refused["data"]["logIn"]["reuseDetectedAt"].is_null());

    let notified = rig.log_in("a@example.com", "a strong password").await;
    assert!(notified["data"]["logIn"]["reuseDetectedAt"].is_string());
}
