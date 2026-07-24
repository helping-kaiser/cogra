// API library — schema and router construction, the L1 seam, ingestion,
// and the bootstrap orchestration, separated from the binaries so tests
// and the tools can use them without a running server.

pub mod bootstrap;
pub mod ingest;
pub mod l1;
pub mod prepare;
pub mod relay;
pub mod schema;

use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::extract::State;
use axum::routing::{get, post};
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

async fn graphql_handler(State(schema): State<ApiSchema>, req: GraphQLRequest) -> GraphQLResponse {
    schema.execute(req.into_inner()).await.into()
}

/// Builds the HTTP surface: POST /graphql, GET /health, and — in dev
/// builds only — GET /playground.
pub fn app(schema: ApiSchema) -> Router {
    let mut router = Router::new()
        .route("/graphql", post(graphql_handler))
        .route("/health", get(health));
    if cfg!(debug_assertions) {
        router = router.route("/playground", get(playground));
    }
    router.with_state(schema)
}
