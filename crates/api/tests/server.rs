//! HTTP-surface integration tests: the liveness endpoint and the
//! anonymous GraphQL reads — health, the host seal key, and the
//! invite-link pre-submit check — against a live Postgres (`make up`).
//! Each test builds the router in-process; no server binary is spawned.

use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use sqlx::PgPool;
use tower::ServiceExt;

mod rig;
use l1_standin::{StandIn, StandInConfig};
use rig::body_json;

/// The full router over a test pool.
fn test_app(pool: PgPool) -> axum::Router {
    rig::connect_info_app(
        pool,
        Arc::new(api::mailer::DevMailer::new(None)),
        api::ratelimit::RateLimitConfig::unlimited(),
    )
}

/// The health endpoint reports liveness.
/// ´claim:server:health-reports-liveness´
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

/// The health query reports the store and the mirror alongside liveness.
/// ´claim:server:health-reports-store-and-mirror´
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

/// With the cursor table dropped out from under the resolver, the failed
/// read surfaces as null — never as the legitimate "-1, nothing
/// ingested", which a probe would read as a healthy empty mirror.
///
/// A failed cursor read surfaces as null, never as the legitimate nothing-ingested value a probe would read as a healthy empty mirror.
/// ´claim:server:a-failed-read-is-null-not-a-value´
#[sqlx::test(migrations = "../../migrations")]
async fn health_reports_a_failed_cursor_read_as_null(pool: PgPool) {
    sqlx::query("DROP TABLE mirror_epoch_cursor")
        .execute(&pool)
        .await
        .expect("drop");
    let app = test_app(pool);
    let query = r#"{"query":"{ health { postgresConnected mirrorEpoch } }"}"#;
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
    let health = &body_json(response).await["data"]["health"];
    assert_eq!(health["postgresConnected"], true);
    assert!(health["mirrorEpoch"].is_null());
}

/// The GraphQL route is body-bounded like every other write route: a
/// request over the ceiling is cut at the connection rather than read
/// into memory. `MultipartOptions` bounds only the file part of a
/// multipart request, and `DefaultBodyLimit` cannot reach a handler that
/// consumes the body stream itself, so the bound has to wrap the body.
/// The caps are shrunk here so the oversized body is kilobytes rather
/// than the two hundred megabytes the deployed ceiling would need.
///
/// Both ways a body arrives are covered: a declared `Content-Length` is
/// refused by the layer before a byte is read, and an undeclared one is
/// cut mid-stream and still named as the ceiling rather than as an
/// internal fault.
///
/// A GraphQL request past the route's body ceiling is refused at the transport, whatever its content type.
/// ´claim:server:the-graphql-body-is-bounded´
#[sqlx::test(migrations = "../../migrations")]
async fn graphql_refuses_a_body_past_the_route_limit(pool: PgPool) {
    let (mut ctx, auth) = rig::api_context(
        pool,
        Arc::new(api::mailer::DevMailer::new(None)),
        api::ratelimit::RateLimitConfig::unlimited(),
    );
    ctx.media.max_upload_bytes = 1024;
    ctx.media.max_video_upload_bytes = 1024;
    ctx.media.upload_part_size_bytes = 1024;
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

    let padding = "x".repeat(8 * 1024);
    let body = serde_json::json!({ "query": format!("{{ __typename }}#{padding}") }).to_string();

    let declared = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/graphql")
                .header("content-type", "application/json")
                .header("content-length", body.len())
                .body(Body::from(body.clone()))
                .expect("request"),
        )
        .await
        .expect("response");
    assert_eq!(declared.status(), StatusCode::PAYLOAD_TOO_LARGE);

    let streamed = app
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
    assert_eq!(streamed.status(), StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(body_json(streamed).await["code"], "PAYLOAD_TOO_LARGE");
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

/// The host's own seal key is served for clients to verify against.
/// ´claim:server:the-host-seal-key-is-served´
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

/// A live link reads usable, named, and bounded; a revoked one still
/// resolves but unusable; an unknown id resolves to null, so a guess
/// learns nothing. Expiry is compared as an instant rather than a string,
/// because Postgres stores microseconds.
///
/// An invite link's capability reads anonymously, live, revoked and unknown each answering in their own way so a guess at an identifier learns nothing.
/// ´claim:server:an-invite-link-reads-anonymously´
#[sqlx::test(migrations = "../../migrations")]
async fn invite_link_check_reads_the_capability_anonymously(pool: PgPool) {
    let expires = chrono::Utc::now() + chrono::Duration::days(1);
    let link = seed_link(&pool, "inviter", expires).await;
    let query =
        format!("{{ inviteLinkCheck(id: \"{link}\") {{ usable inviterHandle expiresAt }} }}");

    let data = gql(test_app(pool.clone()), query.clone()).await;
    let check = &data["inviteLinkCheck"];
    assert_eq!(check["usable"], true);
    assert_eq!(check["inviterHandle"], "inviter");
    let served =
        chrono::DateTime::parse_from_rfc3339(check["expiresAt"].as_str().expect("expiresAt"))
            .expect("rfc3339");
    assert!((served.with_timezone(&chrono::Utc) - expires).abs() < chrono::Duration::seconds(1));

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

    let unknown = uuid::Uuid::new_v4();
    let data = gql(
        test_app(pool),
        format!("{{ inviteLinkCheck(id: \"{unknown}\") {{ usable }} }}"),
    )
    .await;
    assert!(data["inviteLinkCheck"].is_null());
}

/// (´claim:server:an-invite-link-reads-anonymously´)
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
