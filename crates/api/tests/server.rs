//! HTTP-surface integration tests: the liveness endpoint and the GraphQL
//! health query against a live Postgres (`make up`). Each test builds the
//! router in-process; no server binary is spawned.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use sqlx::PgPool;
use tower::ServiceExt;

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
    let app = api::app(api::schema::build(pool));
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
    let app = api::app(api::schema::build(pool));
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
