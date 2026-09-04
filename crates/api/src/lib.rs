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

use std::sync::Arc;

use async_graphql::futures_util::TryStreamExt;
use async_graphql::http::MultipartOptions;
use async_graphql_axum::GraphQLResponse;
use async_graphql_axum::rejection::GraphQLRejection;
use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, Path, Request, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post, put};
use axum::{Json, Router, response::Html};
use axum_client_ip::{ClientIp, ClientIpSource};
use postgres_store::PgPool;
use serde_json::{Value, json};
use tokio_util::compat::TokioAsyncReadCompatExt;
use tokio_util::io::StreamReader;
use uuid::Uuid;

use crate::auth::{AuthConfig, Viewer};
use crate::media::resumable::{self, SessionError};
use crate::media::{BlobStore, MediaConfig};
use crate::ratelimit::RequestIp;
use crate::schema::ApiSchema;

/// An environment variable, or the fallback the caller names.
///
/// It lives in the library because the server, the bootstrap tool and the
/// media configuration all read their settings the same way; three private
/// copies of one line drift apart the moment one of them grows a trim or a
/// case rule.
pub fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

/// Process liveness only — store connectivity is the GraphQL `health`
/// query's job.
async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

async fn playground() -> Html<String> {
    use async_graphql::http::{GraphQLPlaygroundConfig, playground_source};
    Html(playground_source(GraphQLPlaygroundConfig::new("/graphql")))
}

/// What the part route needs and the GraphQL schema keeps to itself.
///
/// The schema owns its context privately, so a second route cannot reach
/// through it for a pool or a store; these travel beside it instead of
/// the router growing a way to unpick a `Schema`.
#[derive(Clone)]
pub struct UploadRouting {
    pub pool: PgPool,
    pub blobs: Arc<dyn BlobStore>,
    pub media: MediaConfig,
}

#[derive(Clone)]
struct AppState {
    schema: ApiSchema,
    auth: AuthConfig,
    multipart: MultipartOptions,
    uploads: UploadRouting,
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

/// The viewer a request carries, or the status that refuses it.
fn bearer_viewer(auth: &AuthConfig, headers: &HeaderMap) -> Option<Viewer> {
    headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .and_then(|token| auth::verify_access_token(auth, token))
}

/// A refusal in the same vocabulary a GraphQL `UserError` uses, so a
/// client handling one shape handles both.
fn upload_error(
    status: StatusCode,
    code: &str,
    message: &str,
    field: &[&str],
) -> axum::response::Response {
    (
        status,
        Json(json!({ "code": code, "message": message, "field": field })),
    )
        .into_response()
}

/// One part of a resumable upload.
///
/// **Why this is a route and not a mutation.** A GraphQL multipart
/// request carries an operations document and a file map beside every
/// binary; repeating that envelope for each of a dozen parts is overhead
/// on the one exchange in the system that is pure bytes. async-graphql
/// also spools each multipart file through a temporary file before a
/// resolver sees it, which is the right trade for one whole upload and
/// the wrong one for a part that exists only to be handed straight to
/// the object store. So the parts ride a plain authenticated `PUT` with
/// the bytes as the body, and GraphQL keeps the two ends — begin and
/// complete — where the rest of the contract lives.
///
/// This does not make the API a media origin. Reads still leave through
/// the store's own host; what crosses here is an upload in progress,
/// exactly as `uploadMedia`'s bytes already do.
///
/// The session id is the only capability, and it is not enough on its
/// own: the viewer's token must resolve to the account that opened the
/// session, so a leaked id buys nothing.
async fn upload_part(
    State(state): State<AppState>,
    Path((session_id, part_number)): Path<(Uuid, u32)>,
    headers: HeaderMap,
    body: Bytes,
) -> axum::response::Response {
    let Some(viewer) = bearer_viewer(&state.auth, &headers) else {
        return upload_error(
            StatusCode::UNAUTHORIZED,
            "UNAUTHENTICATED",
            "this endpoint needs an access token",
            &[],
        );
    };
    let uploads = &state.uploads;

    match postgres_store::auth::credentials_by_actor(&uploads.pool, viewer.user_id).await {
        Ok(Some(credentials))
            if credentials.account_state == postgres_store::auth::AccountState::Member => {}
        Ok(_) => {
            return upload_error(
                StatusCode::FORBIDDEN,
                "FORBIDDEN",
                "only a member may upload",
                &[],
            );
        }
        Err(e) => {
            tracing::error!(error = %e, "upload part viewer lookup failed");
            return upload_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL",
                "internal error",
                &[],
            );
        }
    }

    match resumable::receive_part(
        &uploads.pool,
        uploads.blobs.as_ref(),
        viewer.user_id,
        session_id,
        part_number,
        body.to_vec(),
    )
    .await
    {
        Ok(receipt) => Json(json!({
            "partNumber": receipt.part_number,
            "receivedParts": receipt.received_parts,
            "partCount": receipt.part_count,
        }))
        .into_response(),
        Err(SessionError::NotFound) => upload_error(
            StatusCode::NOT_FOUND,
            "NOT_FOUND",
            "no such upload session",
            &["uploadId"],
        ),
        Err(SessionError::BadInput(e)) => {
            let field: Vec<&str> = e.path.iter().map(String::as_str).collect();
            upload_error(StatusCode::BAD_REQUEST, "BAD_INPUT", &e.message, &field)
        }
        Err(SessionError::Refused(e)) => upload_error(
            StatusCode::BAD_REQUEST,
            "BAD_INPUT",
            &e.to_string(),
            &["part"],
        ),
        Err(SessionError::Internal(e)) => {
            tracing::error!(error = %e, "upload part failed");
            upload_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL",
                "internal error",
                &[],
            )
        }
    }
}

/// Builds the HTTP surface: POST /graphql, PUT /media/uploads/…/parts/…,
/// GET /health, and — in dev builds only — GET /playground. Media bytes
/// are not *served* here: reads leave through the media service's own
/// origin, so this process never sits in the path of a picture. Writes
/// are the other direction and always have been.
///
/// `ip_source` is how the client IP is derived (auth.md "Rate
/// limiting"): the socket peer by default; a forwarded header only when
/// a trusted proxy is the sole ingress (`CLIENT_IP_SOURCE`,
/// development.md).
///
/// The part route carries a body limit of twice a part, set apart from
/// the exact size a part must have for the same reason the multipart
/// transport's ceiling is set apart from the upload caps: a body limit
/// refuses before a handler exists and can only answer with a status
/// code, so the readable refusal naming the expected byte count is left
/// to the handler and this catches only what is wildly out of range.
pub fn app(
    schema: ApiSchema,
    auth: AuthConfig,
    ip_source: ClientIpSource,
    uploads: UploadRouting,
) -> Router {
    let media = &uploads.media;
    let multipart = MultipartOptions::default()
        .max_file_size(media.transport_limit_bytes())
        .max_num_files(1);
    let part_limit = media.upload_part_size_bytes.saturating_mul(2);
    let mut router = Router::new()
        .route("/graphql", post(graphql_handler))
        .route(
            "/media/uploads/{session_id}/parts/{part_number}",
            put(upload_part).layer(DefaultBodyLimit::max(part_limit)),
        )
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
            uploads,
        })
}
