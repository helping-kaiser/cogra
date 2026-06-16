// API library — schema and router construction, separated from the binary
// so tests and the export-schema tool can use them without a running server.

pub mod schema;

use async_graphql_axum::GraphQL;
use axum::routing::{get, post_service};
use axum::{Json, Router, response::Html};
use serde_json::{Value, json};

use crate::schema::ApiSchema;

/// Process liveness only — store connectivity is the GraphQL `health`
/// query's job.
async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

async fn playground() -> Html<String> {
    use async_graphql::http::{GraphQLPlaygroundConfig, playground_source};
    Html(playground_source(GraphQLPlaygroundConfig::new("/graphql")))
}

/// Builds the HTTP surface from docs/implementation/api-spec.md:
/// POST /graphql, GET /health, and — in dev builds only — GET /playground.
pub fn app(schema: ApiSchema) -> Router {
    let router = Router::new()
        .route("/graphql", post_service(GraphQL::new(schema)))
        .route("/health", get(health));
    if cfg!(debug_assertions) {
        router.route("/playground", get(playground))
    } else {
        router
    }
}
