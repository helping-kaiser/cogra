//! Schema and router construction, the L1 seam, ingestion, and the
//! bootstrap orchestration.
//!
//! These live in the library rather than the binaries so tests and the
//! tools can drive them without a running server.

pub mod auth;
pub mod bootstrap;
pub mod breach;
pub mod content;
pub mod ingest;
pub mod l1;
pub mod loaders;
pub mod mailer;
pub mod media;
pub mod nodes;
pub mod onboarding;
pub mod prepare;
pub mod profile;
pub mod ratelimit;
pub mod references;
pub mod relay;
pub mod schema;
pub mod stance;
pub mod topics;

use async_graphql::futures_util::TryStreamExt;
use async_graphql::http::MultipartOptions;
use async_graphql_axum::GraphQLResponse;
use async_graphql_axum::rejection::GraphQLRejection;
use axum::extract::{Request, State};
use axum::routing::{get, post};
use axum::{Json, Router, response::Html};
use axum_client_ip::{ClientIp, ClientIpSource};
use serde_json::{Value, json};
use tokio_util::compat::TokioAsyncReadCompatExt;
use tokio_util::io::StreamReader;

use crate::auth::{AuthConfig, Viewer};
use crate::media::MediaConfig;
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
    multipart: MultipartOptions,
}

/// Resolves the request's viewer from `Authorization: Bearer <token>`
/// before execution (auth.md "Access token") and rides it, with the
/// derived client IP, into the GraphQL context — resolvers read
/// `Option<Viewer>` and `RequestIp`.
///
/// The body is parsed here rather than through the library's own
/// extractor because that extractor hard-codes `MultipartOptions`
/// defaults, and the defaults are *no limits at all*: an unbounded file
/// size and an unbounded file count. `uploadMedia` is the one mutation
/// that carries a binary, so leaving that as it comes would make a
/// single request an unbounded write. Everything else about the parse is
/// the extractor's own pipeline — body stream, `StreamReader`, the
/// compatibility shim, `receive_batch_body`.
async fn graphql_handler(
    State(state): State<AppState>,
    ClientIp(ip): ClientIp,
    req: Request,
) -> Result<GraphQLResponse, GraphQLRejection> {
    let (parts, body) = req.into_parts();
    let viewer: Option<Viewer> = parts
        .headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .and_then(|token| auth::verify_access_token(&state.auth, token));
    let content_type = parts
        .headers
        .get(axum::http::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);

    let reader = StreamReader::new(body.into_data_stream().map_err(std::io::Error::other)).compat();
    let request = async_graphql::http::receive_batch_body(content_type, reader, state.multipart)
        .await
        .map_err(GraphQLRejection)?
        .into_single()
        .map_err(GraphQLRejection)?;

    Ok(state
        .schema
        .execute(request.data(viewer).data(RequestIp(ip)))
        .await
        .into())
}

/// Builds the HTTP surface: POST /graphql, GET /health, and — in dev
/// builds only — GET /playground. Media bytes are not served here: they
/// leave through the media service's own origin, so this process never
/// sits in the path of a picture.
///
/// `ip_source` is how the client IP is derived (auth.md "Rate
/// limiting"): the socket peer by default; a forwarded header only when
/// a trusted proxy is the sole ingress (`CLIENT_IP_SOURCE`,
/// development.md).
pub fn app(
    schema: ApiSchema,
    auth: AuthConfig,
    ip_source: ClientIpSource,
    media: &MediaConfig,
) -> Router {
    let multipart = MultipartOptions::default()
        .max_file_size(media.transport_limit_bytes())
        .max_num_files(1);
    let mut router = Router::new()
        .route("/graphql", post(graphql_handler))
        .route("/health", get(health));
    if cfg!(debug_assertions) {
        router = router.route("/playground", get(playground));
    }
    router
        .layer(ip_source.into_extension())
        .with_state(AppState {
            schema,
            auth,
            multipart,
        })
}
