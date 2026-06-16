//! HTTP-surface integration tests — require both databases to be running
//! (`make up`); connection comes from DATABASE_URL / MEMGRAPH_HOST /
//! MEMGRAPH_PORT, matching CI's service containers.

use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::util::ServiceExt;

async fn test_app() -> axum::Router {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = postgres_store::connect(&database_url)
        .await
        .expect("Postgres must be running (make up)");
    postgres_store::run_migrations(&pool)
        .await
        .expect("migrations apply");

    let host = std::env::var("MEMGRAPH_HOST").unwrap_or_else(|_| "localhost".into());
    let port = std::env::var("MEMGRAPH_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(7687);
    let graph = graph_engine::connect(&host, port)
        .await
        .expect("Memgraph must be running (make up)");
    graph_engine::schema::apply_schema(&graph)
        .await
        .expect("graph schema applies");

    api::app(api::schema::build(pool, graph))
}

#[tokio::test]
async fn health_endpoint_reports_ok() {
    let app = test_app().await;
    let response = app
        .oneshot(
            Request::get("/health")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let body = response
        .into_body()
        .collect()
        .await
        .expect("body")
        .to_bytes();
    let value: Value = serde_json::from_slice(&body).expect("json");
    assert_eq!(value["status"], "ok");
}

#[tokio::test]
async fn graphql_health_query_sees_both_stores() {
    let app = test_app().await;
    let query = json!({
        "query": "{ health { backendVersion postgresConnected memgraphConnected } }"
    });
    let response = app
        .oneshot(
            Request::post("/graphql")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(query.to_string()))
                .expect("request"),
        )
        .await
        .expect("response");
    assert_eq!(response.status(), StatusCode::OK);

    let body = response
        .into_body()
        .collect()
        .await
        .expect("body")
        .to_bytes();
    let value: Value = serde_json::from_slice(&body).expect("json");
    let health = &value["data"]["health"];
    assert_eq!(health["backendVersion"], env!("CARGO_PKG_VERSION"));
    assert_eq!(health["postgresConnected"], true, "{value}");
    assert_eq!(health["memgraphConnected"], true, "{value}");
}

#[tokio::test]
async fn playground_is_served_in_dev_builds() {
    let app = test_app().await;
    let response = app
        .oneshot(
            Request::get("/playground")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response");
    assert_eq!(response.status(), StatusCode::OK);
}
