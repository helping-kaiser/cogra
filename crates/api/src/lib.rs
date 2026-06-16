// API library — schema and router construction, separated from the binary
// so tests and the export-schema/bootstrap tools can use them without a
// running server.

pub mod auth;
pub mod schema;

use std::sync::Arc;

use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::extract::State;
use axum::http::HeaderMap;
use axum::http::header::AUTHORIZATION;
use axum::routing::{get, post};
use axum::{Json, Router, response::Html};
use serde_json::{Value, json};

use crate::auth::Viewer;
use crate::auth::jwt::JwtKeys;
use crate::schema::ApiSchema;

/// Shared HTTP state: the executable schema plus the JWT keys used to resolve
/// the request viewer before execution.
#[derive(Clone)]
struct AppState {
    schema: ApiSchema,
    jwt: Arc<JwtKeys>,
}

/// Process liveness only — store connectivity is the GraphQL `health` query's
/// job.
async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

async fn playground() -> Html<String> {
    use async_graphql::http::{GraphQLPlaygroundConfig, playground_source};
    Html(playground_source(GraphQLPlaygroundConfig::new("/graphql")))
}

/// Resolves the request viewer from the `Authorization` header and executes
/// the GraphQL request with it injected into the execution context. Reads are
/// anonymous-safe; an invalid token resolves to an anonymous viewer
/// (api-spec.md "Viewer context rides the request").
async fn graphql_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    req: GraphQLRequest,
) -> GraphQLResponse {
    let bearer = headers.get(AUTHORIZATION).and_then(|v| v.to_str().ok());
    let viewer = Viewer::from_bearer(bearer, &state.jwt);
    state
        .schema
        .execute(req.into_inner().data(viewer))
        .await
        .into()
}

/// Builds the HTTP surface from docs/implementation/api-spec.md: POST
/// /graphql, GET /health, and — in dev builds only — GET /playground.
pub fn app(schema: ApiSchema, jwt: Arc<JwtKeys>) -> Router {
    let state = AppState { schema, jwt };
    let mut router = Router::new()
        .route("/graphql", post(graphql_handler))
        .route("/health", get(health));
    if cfg!(debug_assertions) {
        router = router.route("/playground", get(playground));
    }
    router.with_state(state)
}
