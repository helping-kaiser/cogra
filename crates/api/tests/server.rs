//! HTTP-surface integration tests: the liveness endpoint and the
//! anonymous GraphQL reads — health, the host seal key, and the
//! invite-link pre-submit check — against a live Postgres (`make up`).
//! Each test builds the router in-process; no server binary is spawned.

use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use l1_standin::{StandIn, StandInConfig};
use sqlx::PgPool;
use tower::ServiceExt;

/// The full router over a test pool, with an ephemeral session key.
fn test_app(pool: PgPool) -> axum::Router {
    let standin = StandIn::new(pool.clone(), StandInConfig::default());
    let auth = api::auth::AuthConfig::ephemeral().expect("auth config");
    let schema = api::schema::build(api::schema::ApiContext {
        pool,
        boundary: api::l1::StandInBoundary(standin.clone()),
        funding: standin,
        auth: auth.clone(),
        mailer: Arc::new(api::mailer::DevMailer),
        onboarding: api::onboarding::OnboardingConfig::default(),
    });
    api::app(schema, auth)
}

async fn body_json(response: axum::response::Response) -> serde_json::Value {
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("body")
        .to_bytes();
    serde_json::from_slice(&bytes).expect("json body")
}

#[sqlx::test(migrations = "../../migrations")]
async fn health_endpoint_reports_liveness(pool: PgPool) {
    let app = test_app(pool);
    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(body_json(response).await["status"], "ok");
}

#[sqlx::test(migrations = "../../migrations")]
async fn graphql_health_reports_store_and_mirror(pool: PgPool) {
    let app = test_app(pool);
    let query = r#"{"query":"{ health { backendVersion postgresConnected mirrorEpoch } }"}"#;
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/graphql")
                .header("content-type", "application/json")
                .body(Body::from(query))
                .expect("request"),
        )
        .await
        .expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let json = body_json(response).await;
    let health = &json["data"]["health"];
    assert_eq!(health["postgresConnected"], true);
    assert_eq!(health["mirrorEpoch"], -1);
    assert_eq!(health["backendVersion"], env!("CARGO_PKG_VERSION"));
}

/// Executes one anonymous GraphQL query and returns the `data` object.
async fn gql(app: axum::Router, query: String) -> serde_json::Value {
    let body = serde_json::json!({ "query": query }).to_string();
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/graphql")
                .header("content-type", "application/json")
                .body(Body::from(body))
                .expect("request"),
        )
        .await
        .expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let json = body_json(response).await;
    assert!(json.get("errors").is_none(), "unexpected errors: {json}");
    json["data"].clone()
}

#[sqlx::test(migrations = "../../migrations")]
async fn graphql_serves_the_host_seal_key(pool: PgPool) {
    use base64::Engine;
    let expected = StandIn::new(pool.clone(), StandInConfig::default())
        .host_public_key()
        .await
        .expect("host key");
    let data = gql(test_app(pool), "{ hostPublicKey }".into()).await;
    assert_eq!(
        data["hostPublicKey"],
        base64::engine::general_purpose::STANDARD.encode(expected)
    );
}

/// Seeds an actor and one invite link expiring at `expires_at`, returning
/// the link id.
async fn seed_link(
    pool: &PgPool,
    handle: &str,
    expires_at: chrono::DateTime<chrono::Utc>,
) -> uuid::Uuid {
    let key = common::l1::client::ActorKey::generate();
    let inviter = uuid::Uuid::new_v4();
    let mut conn = pool.acquire().await.expect("conn");
    postgres_store::genesis::insert_actor(
        &mut conn,
        inviter,
        "user",
        handle,
        &key.public_key_bytes(),
        &key.address(),
    )
    .await
    .expect("actor");
    postgres_store::auth::create_invite_link(
        pool,
        uuid::Uuid::new_v4(),
        inviter,
        0.1,
        0.1,
        false,
        expires_at,
    )
    .await
    .expect("link")
    .id
}

#[sqlx::test(migrations = "../../migrations")]
async fn invite_link_check_reads_the_capability_anonymously(pool: PgPool) {
    let expires = chrono::Utc::now() + chrono::Duration::days(1);
    let link = seed_link(&pool, "inviter", expires).await;
    let query =
        format!("{{ inviteLinkCheck(id: \"{link}\") {{ usable inviterHandle expiresAt }} }}");

    // A live link reads usable, named, and bounded.
    let data = gql(test_app(pool.clone()), query.clone()).await;
    let check = &data["inviteLinkCheck"];
    assert_eq!(check["usable"], true);
    assert_eq!(check["inviterHandle"], "inviter");
    // Postgres stores microseconds; compare instants, not strings.
    let served =
        chrono::DateTime::parse_from_rfc3339(check["expiresAt"].as_str().expect("expiresAt"))
            .expect("rfc3339");
    assert!((served.with_timezone(&chrono::Utc) - expires).abs() < chrono::Duration::seconds(1));

    // A revoked link still resolves, unusable.
    let inviter = postgres_store::auth::invite_link(&pool, link)
        .await
        .expect("query")
        .expect("link")
        .inviter_id;
    assert!(
        postgres_store::auth::revoke_invite_link(&pool, link, inviter)
            .await
            .expect("revokes")
    );
    let data = gql(test_app(pool.clone()), query).await;
    assert_eq!(data["inviteLinkCheck"]["usable"], false);

    // An unknown id resolves to null — nothing to learn from a guess.
    let unknown = uuid::Uuid::new_v4();
    let data = gql(
        test_app(pool),
        format!("{{ inviteLinkCheck(id: \"{unknown}\") {{ usable }} }}"),
    )
    .await;
    assert!(data["inviteLinkCheck"].is_null());
}

#[sqlx::test(migrations = "../../migrations")]
async fn invite_link_check_reads_expiry_as_unusable(pool: PgPool) {
    let link = seed_link(
        &pool,
        "inviter",
        chrono::Utc::now() - chrono::Duration::hours(1),
    )
    .await;
    let data = gql(
        test_app(pool),
        format!("{{ inviteLinkCheck(id: \"{link}\") {{ usable }} }}"),
    )
    .await;
    assert_eq!(data["inviteLinkCheck"]["usable"], false);
}
