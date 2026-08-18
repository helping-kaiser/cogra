// API library — schema and router construction, the L1 seam, ingestion,
// and the bootstrap orchestration, separated from the binaries so tests
// and the tools can use them without a running server.

pub mod auth;
pub mod bootstrap;
pub mod breach;
pub mod content;
pub mod ingest;
pub mod l1;
pub mod mailer;
pub mod onboarding;
pub mod prepare;
pub mod profile;
pub mod ratelimit;
pub mod relay;
pub mod schema;
pub mod stance;

use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::extract::State;
use axum::http::HeaderMap;
use axum::routing::{get, post};
use axum::{Json, Router, response::Html};
use axum_client_ip::{ClientIp, ClientIpSource};
use serde_json::{Value, json};

use crate::auth::{AuthConfig, Viewer};
use crate::ratelimit::RequestIp;
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

#[derive(Clone)]
struct AppState {
    schema: ApiSchema,
    auth: AuthConfig,
}

/// Resolves the request's viewer from `Authorization: Bearer <token>`
/// before execution (auth.md "Access token") and rides it, with the
/// derived client IP, into the GraphQL context — resolvers read
/// `Option<Viewer>` and `RequestIp`.
async fn graphql_handler(
    State(state): State<AppState>,
    ClientIp(ip): ClientIp,
    headers: HeaderMap,
    req: GraphQLRequest,
) -> GraphQLResponse {
    let viewer: Option<Viewer> = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .and_then(|token| auth::verify_access_token(&state.auth, token));
    state
        .schema
        .execute(req.into_inner().data(viewer).data(RequestIp(ip)))
        .await
        .into()
}

/// Builds the HTTP surface: POST /graphql, GET /health, and — in dev
/// builds only — GET /playground. `ip_source` is how the client IP is
/// derived (auth.md "Rate limiting"): the socket peer by default; a
/// forwarded header only when a trusted proxy is the sole ingress
/// (`CLIENT_IP_SOURCE`, development.md).
pub fn app(schema: ApiSchema, auth: AuthConfig, ip_source: ClientIpSource) -> Router {
    let mut router = Router::new()
        .route("/graphql", post(graphql_handler))
        .route("/health", get(health));
    if cfg!(debug_assertions) {
        router = router.route("/playground", get(playground));
    }
    router
        .layer(ip_source.into_extension())
        .with_state(AppState { schema, auth })
}
