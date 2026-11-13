//! Schema and router construction, the L1 seam, ingestion, and the
//! bootstrap orchestration.
//!
//! These live in the library rather than the binaries so tests and the
//! tools can drive them without a running server.

pub mod auth;
pub mod bookmarks;
pub mod boot;
pub mod bootstrap;
pub mod breach;
pub mod content;
pub mod deletion;
pub mod dotenv;
pub mod hidden;
pub mod history;
pub mod ingest;
pub mod l1;
pub mod loaders;
pub mod mailer;
pub mod media;
pub mod multipart;
pub mod nodes;
pub mod onboarding;
pub mod prepare;
pub mod profile;
pub mod ranker_pod;
pub mod ratelimit;
pub mod redaction;
pub mod references;
pub mod registry;
pub mod relay;
pub mod removal;
pub mod report;
pub mod schema;
pub mod search;
pub mod shutdown;
pub mod stance;
pub mod topics;

use std::sync::Arc;

use async_graphql::futures_util::TryStreamExt;
use async_graphql_axum::GraphQLResponse;
use async_graphql_axum::rejection::GraphQLRejection;
use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, Path, Request, State};
use axum::http::{Extensions, HeaderMap, StatusCode, Version};
use axum::response::IntoResponse;
use axum::routing::{get, post, put};
use axum::{Json, Router, response::Html};
use axum_client_ip::{ClientIp, ClientIpSource};
use postgres_store::PgPool;
use serde_json::{Value, json};
use tokio_util::compat::TokioAsyncReadCompatExt;
use tokio_util::io::StreamReader;
use tower_http::compression::CompressionLayer;
use tower_http::compression::predicate::{DefaultPredicate, Predicate};
use tower_http::limit::RequestBodyLimitLayer;
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
    multipart: multipart::MultipartLimits,
    anonymous_upload_absorb_bytes: usize,
    uploads: UploadRouting,
}

/// Resolves the request's viewer from `Authorization: Bearer <token>`
/// before execution (auth.md "Access token") and rides it, with the
/// derived client IP, into the GraphQL context — resolvers read
/// `Option<Viewer>` and `RequestIp`. A token whose account has no login
/// any more — its deletion executed — resolves to no viewer: the token
/// outlives the execution by up to its TTL, and nothing may be signed or
/// written as the executed account (one primary-key read per signed-in
/// request).
///
/// The body is parsed here rather than through the library's own
/// extractor because that extractor hard-codes `MultipartOptions`
/// defaults, and the defaults are *no limits at all*: an unbounded file
/// size and an unbounded file count. `uploadMedia` is the one mutation
/// that carries a binary, so leaving that as it comes would make a
/// single request an unbounded write. A JSON body takes the extractor's
/// own pipeline — body stream, `StreamReader`, the compatibility shim,
/// `receive_batch_body`; a multipart body takes [`multipart`]'s parse,
/// because the library's gives the `operations` and `map` fields the
/// file's limit.
///
/// The whole body is bounded a layer above, by
/// `RequestBodyLimitLayer` on the route (see [`app`]): consuming the body
/// stream directly is precisely the case axum documents `DefaultBodyLimit`
/// as *not* covering, so the limit has to wrap the body rather than ride
/// an extractor. That ceiling is sized for an upload; every body that is
/// not one answers to [`GRAPHQL_JSON_BODY_LIMIT_BYTES`] instead, wrapped
/// here in `http_body_util::Limited` before the library reads a byte,
/// because the library reads a JSON body whole before it parses it. A
/// multipart body holds its `operations` and `map` fields to the same
/// ceiling, and the rest of its envelope to
/// [`multipart::MULTIPART_ENVELOPE_BYTES`].
///
/// A multipart body is parsed only for a verified viewer. Every multipart
/// request is an `uploadMedia`, which needs a session, and its parse
/// spools the file to a temporary file before any resolver could refuse
/// it; so a request whose headers carry no viewer — no bearer, one that
/// does not verify, or one whose account has no login — is answered by
/// [`refuse_anonymous_upload`] without a byte of its body reaching the
/// parser.
async fn graphql_handler(
    State(state): State<AppState>,
    client_ip: Result<ClientIp, axum_client_ip::Rejection>,
    req: Request,
) -> axum::response::Response {
    let ip = match client_ip {
        Ok(ClientIp(ip)) => ip,
        Err(rejection) => return client_ip_refusal(rejection),
    };
    let (parts, body) = req.into_parts();
    let content_type = parts
        .headers
        .get(axum::http::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let multipart_type = multipart_type(content_type.as_deref());
    if multipart_type.is_none()
        && declared_length(&parts.headers).is_some_and(|n| n > GRAPHQL_JSON_BODY_LIMIT_BYTES)
    {
        return body_too_large();
    }
    let viewer = match bearer_viewer(&state.auth, &parts.headers) {
        Some(v) if deletion::viewer_has_login(&state.uploads.pool, v.user_id).await => Some(v),
        _ => None,
    };

    let parsed = match multipart_type {
        Some(_) if viewer.is_none() => {
            return refuse_anonymous_upload(
                &parts.headers,
                body,
                state.anonymous_upload_absorb_bytes,
            )
            .await;
        }
        Some(mime) => {
            match multipart::receive_batch_multipart(
                &mime,
                body.into_data_stream(),
                state.multipart,
            )
            .await
            {
                Ok(batch) => batch.into_single(),
                Err(multipart::MultipartRefusal::TooLarge) => return body_too_large(),
                Err(multipart::MultipartRefusal::Malformed(e)) => Err(e),
            }
        }
        None => {
            let body = axum::body::Body::new(http_body_util::Limited::new(
                body,
                GRAPHQL_JSON_BODY_LIMIT_BYTES,
            ));
            let reader =
                StreamReader::new(body.into_data_stream().map_err(std::io::Error::other)).compat();
            async_graphql::http::receive_batch_body(
                content_type,
                reader,
                async_graphql::http::MultipartOptions::default(),
            )
            .await
            .and_then(async_graphql::BatchRequest::into_single)
        }
    };
    let mut request = match parsed {
        Ok(request) => request,
        Err(e) if over_the_body_limit(&e) => return body_too_large(),
        Err(e) => return GraphQLRejection(e).into_response(),
    };

    let compressible = is_query(&mut request);
    let response: GraphQLResponse = state
        .schema
        .execute(request.data(viewer).data(RequestIp(ip)))
        .await
        .into();
    let mut response = response.into_response();
    if !compressible {
        response.extensions_mut().insert(NeverCompress);
    }
    response
}

/// The answer to a request the configured `CLIENT_IP_SOURCE` names no
/// client address for (auth.md "Rate limiting").
///
/// A header source that is absent or malformed — under
/// `RightmostXForwardedFor`, a request that did not come through the
/// proxy the deployment trusts — is the request's fault, so it is refused
/// as a 400 `BAD_INPUT` transport fault, in the shape every other one
/// takes. The crate's own rejection answers 500 ("Proxy Server
/// Misconfiguration"), which reads as the server breaking and teaches a
/// caller nothing.
///
/// The socket peer is never substituted. A deployment that names a
/// forwarded header has said the peer is the proxy, not the client: a
/// fallback would key every such request's rate-limit budget by the
/// proxy's or a sibling container's address, one shared budget an
/// attacker could exhaust for everyone, and would hide a proxy that
/// stopped setting the header instead of saying so.
///
/// A missing request extension — no source configured, or `ConnectInfo`
/// absent under the socket-peer source — is the router built wrong, a
/// server fault that stays `INTERNAL`, logged as an error.
fn client_ip_refusal(rejection: axum_client_ip::Rejection) -> axum::response::Response {
    let (status, code, message) = match rejection {
        axum_client_ip::Rejection::ClientIp(e) => {
            tracing::warn!(error = %e, "refused a request with no client address in the configured source");
            (
                StatusCode::BAD_REQUEST,
                "BAD_INPUT",
                format!("the request names no client address in the configured source: {e}"),
            )
        }
        other => {
            tracing::error!(error = %other, "client-IP extraction is misconfigured");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL",
                "internal error".to_owned(),
            )
        }
    };
    (
        status,
        Json(json!({
            "data": null,
            "errors": [{ "message": message, "extensions": { "code": code } }],
        })),
    )
        .into_response()
}

/// Marks a `/graphql` answer the compression layer must leave as it is.
#[derive(Clone, Copy)]
struct NeverCompress;

/// Whether the request's operation is a query — the only operations whose
/// answers are compressed (see [`not_marked_never`]). The parse is the one
/// execution reuses (`Request::parsed_query` caches it), so asking costs
/// no second parse. A document that does not parse, or does not single out
/// one of its operations, is not a query here; execution answers it with
/// its own error.
fn is_query(request: &mut async_graphql::Request) -> bool {
    use async_graphql::parser::types::{DocumentOperations, OperationType};
    let name = request.operation_name.clone();
    let Ok(document) = request.parsed_query() else {
        return false;
    };
    let operation = match (&document.operations, name) {
        (DocumentOperations::Single(operation), _) => Some(operation),
        (DocumentOperations::Multiple(operations), Some(name)) => operations.get(name.as_str()),
        (DocumentOperations::Multiple(_), None) => None,
    };
    operation.is_some_and(|operation| operation.node.ty == OperationType::Query)
}

/// The handler's half of the `/graphql` compression posture
/// (ranked-feed-api §4.13, the BREACH check); [`DefaultPredicate`]'s size
/// and content-type rules are the other half, and the client's
/// `Accept-Encoding` decides the rest.
///
/// **Only queries compress; no mutation answer ever does.** Compressing a
/// response that carries a secret beside attacker-influenced text lets
/// the compressed length leak the secret (the BREACH class), and every
/// piece of session material this api hands out — the access and refresh
/// tokens, a device lock's secret — rides a mutation's payload on this
/// same route. So the scope is cut at the operation type rather than
/// argued response by response: nothing a query can reach carries session
/// material (pinned by `no_query_reaches_session_material`), and a
/// mutation is never compressed whatever it returns. The feed answer —
/// the bytes the obligation exists for — is a query.
///
/// What a query does return to its own viewer (an email address, say)
/// stays out of reach for a second reason: the attack needs the victim's
/// client to send many authenticated requests carrying the attacker's
/// guesses, and this api takes credentials from the `Authorization`
/// header alone — never a cookie — so no other origin can make a browser
/// send an authenticated request at all.
fn not_marked_never(_: StatusCode, _: Version, _: &HeaderMap, ext: &Extensions) -> bool {
    ext.get::<NeverCompress>().is_none()
}

/// Whether a parse failure is the body ceiling being hit rather than a
/// malformed request.
///
/// A body cut by `RequestBodyLimitLayer` surfaces as a stream error
/// several wrappers down — the limited body's own error, boxed by axum,
/// carried through an `io::Error` into async-graphql's parse error — so
/// the whole `source()` chain is walked. This is the same downcast axum's
/// `Bytes` extractor performs to answer 413 instead of 500; without it a
/// client that sends no `Content-Length` (chunked transfer) is told the
/// server broke rather than that the body was too large.
fn over_the_body_limit(err: &(dyn std::error::Error + 'static)) -> bool {
    let mut cause = Some(err);
    while let Some(e) = cause {
        if e.is::<http_body_util::LengthLimitError>() {
            return true;
        }
        cause = e.source();
    }
    false
}

/// The ceiling on a `/graphql` body that is not a multipart upload
/// (api-spec.md "Query budgets").
///
/// Measured, not chosen, the way the depth and complexity ceilings are.
/// The longest operation either client sends is the web history page at
/// 6 116 bytes with its fragments, comments included. The widest content
/// gesture is a media post at every text cap — title 100, description
/// 500, sensitive reason 140, ten descriptions of 1 000 — so 10 740
/// scalar values, each at most six bytes once JSON-encoded (a `\u00XX`
/// escape): about 75 KB with its document, topics and citations. The
/// widest request of all is a relay carrying the longest batch one
/// prepare can stage under the shipped signing budget
/// ([`ratelimit::SigningBudget::longest_batch`], 1 000): about 256 bytes
/// an entry — a staged-write id and a base64 pre-commitment of two 32-byte
/// nonces and a 64-byte signature — so about 258 KB. 384 KiB is the
/// smallest multiple of 64 KiB above the 1.5× floor over it, and it
/// bounds what an anonymous caller makes the server hold before the parse.
/// `the_widest_legitimate_request_fits_under_the_json_ceiling` re-measures
/// both against it.
pub const GRAPHQL_JSON_BODY_LIMIT_BYTES: usize = 384 * 1024;

/// The body's content type when it is a multipart upload. The same parse
/// and the same test the library's `receive_batch_body` applies, so the
/// upload ceiling never covers a body the library reads as JSON: an
/// absent or unparseable content type is JSON there too.
fn multipart_type(content_type: Option<&str>) -> Option<mime::Mime> {
    content_type
        .and_then(|value| value.parse::<mime::Mime>().ok())
        .filter(|value| value.type_() == mime::MULTIPART)
}

/// The body length the request declares, when it declares one.
fn declared_length(headers: &HeaderMap) -> Option<usize> {
    headers
        .get(axum::http::header::CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse().ok())
}

/// The refusal of a body past the ceiling its request answers to.
fn body_too_large() -> axum::response::Response {
    upload_error(
        StatusCode::PAYLOAD_TOO_LARGE,
        "PAYLOAD_TOO_LARGE",
        "the request body is larger than this endpoint accepts",
        &[],
    )
}

/// The answer to a multipart request with no verified viewer
/// (api-spec.md "Uploads need a session at the door").
///
/// **The answer is the one an unauthenticated `uploadMedia` always got**:
/// a `200` GraphQL response, `data: null`, one error coded
/// `UNAUTHENTICATED`, in the library's own response type and media type.
/// Both clients refresh and replay on exactly that code in the `errors`
/// array — and on nothing else: a non-2xx status reaches neither client
/// as a GraphQL error, so a `401` here would turn "your access token
/// expired" into "the network failed".
///
/// **Refusing is not the same as not reading.** The decision is made from
/// the headers; but an HTTP/1.1 server that answers and closes while the
/// client is still sending makes its TCP stack reset the connection, and
/// "the reset packet might erase the client's unacknowledged input
/// buffers before they can be read" (RFC 9112 §9.6) — the response
/// written for the client never arrives. OkHttp and the browsers send a
/// request whole before reading its answer, and the web's uploads pass
/// through the Next.js proxy, which answers a reset upstream with its own
/// `500`. So the body is *absorbed* — each frame pulled and dropped, never
/// parsed, never spooled, never held — up to `absorb_bytes`, and the
/// answer goes out on a connection left clean for its next request.
///
/// A body that declares more than that, or turns out to carry more, is
/// answered at once with `Connection: close`: no client of this API sends
/// an upload that large in one request, so only a caller that has already
/// left the contract meets the reset.
async fn refuse_anonymous_upload(
    headers: &HeaderMap,
    body: axum::body::Body,
    absorb_bytes: usize,
) -> axum::response::Response {
    let fits = declared_length(headers).is_none_or(|declared| declared <= absorb_bytes);
    let absorbed = fits && absorb(body, absorb_bytes).await;
    let mut response = unauthenticated_upload();
    if !absorbed {
        response.headers_mut().insert(
            axum::http::header::CONNECTION,
            axum::http::HeaderValue::from_static("close"),
        );
    }
    response
}

/// Pulls a body to its end and drops every frame, unless it carries more
/// than `limit` bytes or fails first; whether it reached its end.
async fn absorb(mut body: axum::body::Body, limit: usize) -> bool {
    use http_body_util::BodyExt;
    let mut seen = 0usize;
    while let Some(frame) = body.frame().await {
        let Ok(frame) = frame else {
            return false;
        };
        if let Some(data) = frame.data_ref() {
            seen = seen.saturating_add(data.len());
            if seen > limit {
                return false;
            }
        }
    }
    true
}

/// The `UNAUTHENTICATED` answer [`refuse_anonymous_upload`] gives, in the
/// shape the resolvers' own refusal takes once the library serialises it
/// (`the_upload_door_answers_as_the_resolvers_do` in the integration suite
/// pins the two together).
fn unauthenticated_upload() -> axum::response::Response {
    let mut error = async_graphql::ServerError::new("authentication required", None);
    let mut extensions = async_graphql::ErrorExtensionValues::default();
    extensions.set("code", "UNAUTHENTICATED");
    error.extensions = Some(extensions);
    let response: GraphQLResponse = async_graphql::Response::from_errors(vec![error]).into();
    let mut response = response.into_response();
    response.extensions_mut().insert(NeverCompress);
    response
}

/// How much of a refused upload's body the server pulls and drops before
/// it answers (see [`refuse_anonymous_upload`]): the largest single
/// request either client sends, plus its envelope.
///
/// Both clients send a still in one request up to its cap, and a video in
/// one request only below [`media::RESUMABLE_THRESHOLD_BYTES`]; the
/// envelope is the `operations` and `map` fields at their ceiling and the
/// rest at [`multipart::MULTIPART_ENVELOPE_BYTES`]. At the defaults this
/// is 10 MiB + 704 KiB.
fn anonymous_upload_absorb_bytes(media: &MediaConfig) -> usize {
    media
        .max_upload_bytes
        .max(media::RESUMABLE_THRESHOLD_BYTES)
        .saturating_add(GRAPHQL_JSON_BODY_LIMIT_BYTES.saturating_mul(2))
        .saturating_add(multipart::MULTIPART_ENVELOPE_BYTES)
}

/// The viewer a request's `Authorization: Bearer <token>` header carries
/// (auth.md "Access token"), for every route that reads one.
///
/// The scheme name is matched case-insensitively — RFC 9110 §11.1 makes
/// every authentication scheme name case-insensitive, and RFC 6750 §2.1's
/// `Bearer` is one — and is separated from the token by spaces.
fn bearer_viewer(auth: &AuthConfig, headers: &HeaderMap) -> Option<Viewer> {
    let value = headers
        .get(axum::http::header::AUTHORIZATION)?
        .to_str()
        .ok()?;
    let (scheme, token) = value.split_once(' ')?;
    if !scheme.eq_ignore_ascii_case("Bearer") {
        return None;
    }
    auth::verify_access_token(auth, token.trim_start_matches(' '))
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
///
/// `/graphql` carries the same kind of ceiling one layer out. The
/// multipart limits bound the fields of a multipart request and nothing
/// else — a plain JSON body passes them untouched — and `DefaultBodyLimit` cannot
/// help, because it reaches only extractors that read the body through
/// `Bytes` and this handler consumes the body stream itself.
/// `tower_http`'s `RequestBodyLimitLayer` wraps the body instead of the
/// extractor, which is what axum's own documentation points at for a
/// handler in this shape. The bound sits one part above the multipart
/// transport ceiling so that the file part is always refused by the
/// readable multipart error rather than by the connection being cut. It
/// is the upload's ceiling only: a body that is not multipart answers to
/// [`GRAPHQL_JSON_BODY_LIMIT_BYTES`] inside the handler.
///
/// `/graphql` answers compressed itself (ranked-feed-api §4.13): gzip, to
/// any client that accepts it, so the feed's wire obligation holds in
/// every deployment, dev included, and an edge proxy in front adds no
/// second encoding. Which answers may compress is [`not_marked_never`]'s.
pub fn app(
    schema: ApiSchema,
    auth: AuthConfig,
    ip_source: ClientIpSource,
    uploads: UploadRouting,
) -> Router {
    let media = &uploads.media;
    let multipart = multipart::MultipartLimits {
        json_field_bytes: GRAPHQL_JSON_BODY_LIMIT_BYTES,
        file_bytes: media.transport_limit_bytes(),
        max_files: 1,
    };
    let part_limit = media.upload_part_size_bytes.saturating_mul(2);
    let graphql_limit = media
        .transport_limit_bytes()
        .saturating_add(media.upload_part_size_bytes);
    let mut router = Router::new()
        .route(
            "/graphql",
            post(graphql_handler)
                .layer::<_, std::convert::Infallible>(RequestBodyLimitLayer::new(graphql_limit))
                .layer(
                    CompressionLayer::new()
                        .compress_when(DefaultPredicate::new().and(not_marked_never)),
                ),
        )
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
            anonymous_upload_absorb_bytes: anonymous_upload_absorb_bytes(&uploads.media),
            uploads,
        })
}
