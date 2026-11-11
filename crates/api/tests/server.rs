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
    assert_eq!(
        health["mirrorEpoch"], 0,
        "epochs number from 1; 0 is nothing ingested"
    );
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

/// The ceiling a non-multipart `/graphql` body answers to.
const JSON_CEILING: usize = api::GRAPHQL_JSON_BODY_LIMIT_BYTES;

/// A plain JSON request answers to a ceiling of its own, far below the
/// multipart upload transport's, and is refused with 413 before the parse
/// — under the deployed media caps, not shrunk ones, because the defect
/// was a JSON body admitted up to the upload ceiling. A declared length
/// past it is refused unread, an undeclared one is cut at it, and a body
/// that never ends is answered at all, which only a cut can do.
///
/// A non-multipart GraphQL body past its own ceiling is refused with 413 before the parse, however it arrives.
/// ´claim:server:a-json-body-has-its-own-ceiling´
#[sqlx::test(migrations = "../../migrations")]
async fn a_json_body_past_its_ceiling_is_refused_before_the_parse(pool: PgPool) {
    use async_graphql::futures_util::{StreamExt, stream};
    let app = test_app(pool);
    let padding = "x".repeat(2 * JSON_CEILING);
    let body = serde_json::json!({ "query": format!("{{ __typename }}#{padding}") }).to_string();
    let post = |length: Option<usize>, body: Body| {
        let mut builder = Request::builder()
            .method("POST")
            .uri("/graphql")
            .header("content-type", "application/json");
        if let Some(length) = length {
            builder = builder.header("content-length", length);
        }
        builder.body(body).expect("request")
    };

    let declared = app
        .clone()
        .oneshot(post(Some(body.len()), Body::from(body.clone())))
        .await
        .expect("response");
    assert_eq!(declared.status(), StatusCode::PAYLOAD_TOO_LARGE);

    let streamed = app
        .clone()
        .oneshot(post(None, Body::from(body)))
        .await
        .expect("response");
    assert_eq!(streamed.status(), StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(body_json(streamed).await["code"], "PAYLOAD_TOO_LARGE");

    let opening = stream::once(async {
        Ok::<_, std::io::Error>(axum::body::Bytes::from_static(br#"{"query":"#))
    });
    let endless = stream::repeat_with(|| {
        Ok::<_, std::io::Error>(axum::body::Bytes::from_static(&[b' '; 8192]))
    });
    let unending = app
        .oneshot(post(None, Body::from_stream(opening.chain(endless))))
        .await
        .expect("response");
    assert_eq!(unending.status(), StatusCode::PAYLOAD_TOO_LARGE);
}

/// The JSON ceiling is measured from the clients, so the widest request a
/// client can legitimately send must pass it with headroom: the post
/// composer's whole document file beside a media post at every text cap,
/// each character the six-byte JSON escape, and a relay carrying the
/// longest batch the shipped signing budget lets one prepare stage. A
/// cap, a budget or a document growing into the headroom fails here
/// before it grows past the ceiling.
///
/// The widest legitimate request passes the JSON body ceiling with at least half again as much room.
/// ´claim:server:the-widest-legitimate-request-fits´
#[sqlx::test(migrations = "../../migrations")]
async fn the_widest_legitimate_request_fits_under_the_json_ceiling(pool: PgPool) {
    use api::content::{MAX_DESCRIPTION_CHARS, MAX_SENSITIVE_REASON_CHARS, MAX_TITLE_CHARS};
    use api::media::{MAX_ALT_TEXT_CHARS, MAX_POST_ATTACHMENTS};
    let widest = |chars: usize| "\u{1}".repeat(chars);
    let attachments: Vec<serde_json::Value> = (0..MAX_POST_ATTACHMENTS)
        .map(|i| {
            serde_json::json!({
                "mediaId": uuid::Uuid::new_v4(),
                "displayOrder": i,
                "altText": widest(MAX_ALT_TEXT_CHARS),
            })
        })
        .collect();
    let tags: Vec<serde_json::Value> = (0..api::topics::MAX_TAGS_PER_BATCH)
        .map(|_| {
            serde_json::json!({
                "name": "a".repeat(common::l1::identifier::MAX_ATOM_BYTES),
                "pDirected": 1.0,
                "pInterest": 1.0,
            })
        })
        .collect();
    let references: Vec<serde_json::Value> = (0..api::references::MAX_REFERENCES_PER_BATCH)
        .map(|_| {
            serde_json::json!({
                "target": uuid::Uuid::new_v4(),
                "relevance": 1.0,
                "support": 1.0,
            })
        })
        .collect();
    let body = serde_json::json!({
        "query": include_str!("../../../web/src/lib/graphql/content.graphql"),
        "operationName": "PreparePost",
        "variables": { "input": {
            "title": widest(MAX_TITLE_CHARS),
            "description": widest(MAX_DESCRIPTION_CHARS),
            "license": { "attribution": 1.0, "provenance": 1.0 },
            "pDirected": 1.0,
            "tags": tags,
            "references": references,
            "attachments": attachments,
            "sensitive": true,
            "sensitiveReason": widest(MAX_SENSITIVE_REASON_CHARS),
        }},
    })
    .to_string();

    use base64::Engine;
    let signature = base64::engine::general_purpose::STANDARD.encode(
        common::l1::wire::encode_pre_commitment(&[0xff; common::l1::crypto::SALT_LEN], &[0xff; 64]),
    );
    let longest = api::ratelimit::SigningBudget::default().longest_batch();
    let proposals: Vec<serde_json::Value> = (0..longest)
        .map(|_| serde_json::json!({ "stagedWriteId": uuid::Uuid::new_v4(), "signature": signature }))
        .collect();
    let relay = serde_json::json!({
        "query": include_str!("../../../web/src/lib/graphql/writes.graphql"),
        "operationName": "SubmitProposals",
        "variables": { "input": { "proposals": proposals }},
    })
    .to_string();

    let app = test_app(pool);
    for body in [body, relay] {
        assert!(
            body.len() * 3 / 2 <= JSON_CEILING,
            "a legitimate request is {} bytes, too close to the {JSON_CEILING}-byte ceiling",
            body.len()
        );
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/graphql")
                    .header("content-type", "application/json")
                    .header("content-length", body.len())
                    .body(Body::from(body))
                    .expect("request"),
            )
            .await
            .expect("response");
        assert_eq!(response.status(), StatusCode::OK);
    }
}

/// The JSON ceiling is not the upload's: a multipart picture at exactly
/// the deployed picture cap, far past the JSON ceiling, still uploads.
///
/// A multipart upload at its own cap passes the transport the JSON ceiling would refuse.
/// ´claim:server:an-upload-keeps-its-own-ceiling´
#[sqlx::test(migrations = "../../migrations")]
async fn an_upload_at_its_cap_is_not_held_to_the_json_ceiling(pool: PgPool) {
    let cap = api::media::MediaConfig::default().max_upload_bytes;
    assert!(cap > JSON_CEILING);
    let mut picture = rig::webp_chunk(b"VP8L", &[0x2F, 0x00, 0x00, 0x00, 0x00, 0x88, 0x88, 0x08]);
    let framing = 12 + 8 + picture.len();
    picture.extend_from_slice(&rig::webp_chunk(b"EXIF", &vec![b'x'; cap - framing]));
    let picture = rig::webp_container(&picture);
    assert_eq!(picture.len(), cap);

    let rig = rig::WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    rig.seed_member("uploader", "uploader@example.com").await;
    let token = rig.log_in("uploader@example.com").await;
    let answer = rig.upload_media_raw(&token, &picture).await;
    assert_eq!(
        answer["data"]["uploadMedia"]["userErrors"],
        serde_json::json!([]),
        "{answer}"
    );
    assert!(
        answer["data"]["uploadMedia"]["media"]["id"].is_string(),
        "{answer}"
    );
}

/// A router whose upload transport ceiling is 8 MiB, so a test can tell a
/// refusal at the JSON ceiling from one at the upload ceiling without
/// streaming two hundred megabytes.
fn small_upload_app(pool: PgPool) -> axum::Router {
    let (mut ctx, auth) = rig::api_context(
        pool,
        Arc::new(api::mailer::DevMailer::new(None)),
        api::ratelimit::RateLimitConfig::unlimited(),
    );
    ctx.media.max_upload_bytes = 4 * 1024 * 1024;
    ctx.media.max_video_upload_bytes = 4 * 1024 * 1024;
    let uploads = rig::upload_routing(&ctx);
    api::app(
        api::schema::build(ctx),
        auth,
        axum_client_ip::ClientIpSource::ConnectInfo,
        uploads,
    )
    .layer(axum::Extension(axum::extract::ConnectInfo(
        std::net::SocketAddr::from(([127, 0, 0, 1], 9999)),
    )))
}

/// The multipart boundary the hand-built envelopes below use.
const BOUNDARY: &str = "cogra-test-boundary";

/// The most an envelope the server refuses may have made it pull: both
/// non-file fields at the JSON ceiling plus room for boundaries, part
/// headers and the chunk in flight — far below the 8 MiB transport of
/// [`small_upload_app`].
const PULLED_BEFORE_REFUSAL: usize = 2 * JSON_CEILING + 128 * 1024;

/// Posts an anonymous multipart body that opens with `opening` and then
/// repeats `filler` forever, and counts the bytes the server pulls from it
/// before it answers. A body that never ends can only be answered by a
/// refusal while it streams, and the count shows how much of it the server
/// read first.
async fn post_endless_multipart(
    app: axum::Router,
    opening: Vec<u8>,
    filler: &'static [u8],
) -> (axum::response::Response, usize) {
    use async_graphql::futures_util::{StreamExt, stream};
    use std::sync::atomic::{AtomicUsize, Ordering};
    let pulled = Arc::new(AtomicUsize::new(0));
    let counter = pulled.clone();
    let body = stream::once(async move { axum::body::Bytes::from(opening) })
        .chain(stream::repeat_with(move || {
            axum::body::Bytes::from_static(filler)
        }))
        .map(move |chunk| {
            counter.fetch_add(chunk.len(), Ordering::Relaxed);
            Ok::<_, std::io::Error>(chunk)
        });
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/graphql")
                .header(
                    "content-type",
                    format!("multipart/form-data; boundary={BOUNDARY}"),
                )
                .body(Body::from_stream(body))
                .expect("request"),
        )
        .await
        .expect("response");
    (response, pulled.load(Ordering::Relaxed))
}

/// The opening of a multipart part named `name`, up to its first data byte.
fn part_opening(name: &str) -> String {
    format!("--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n")
}

/// A complete `operations` part for an `uploadMedia` of the file mapped
/// as `0`, and the `map` part that maps it.
fn upload_operations_and_map() -> String {
    let operations = serde_json::json!({
        "query": "mutation($input: UploadMediaInput!) { uploadMedia(input: $input) { media { id } } }",
        "variables": { "input": { "file": null }},
    });
    format!(
        "{}{operations}\r\n{}{{\"0\":[\"variables.input.file\"]}}\r\n",
        part_opening("operations"),
        part_opening("map"),
    )
}

/// An anonymous multipart request whose `operations` field outgrows the
/// JSON ceiling is refused with the JSON path's 413 while it streams,
/// having been read no further than the ceiling — not up to the upload
/// transport ceiling every multipart field used to share.
///
/// A multipart operations field past the JSON ceiling is refused with 413 while it streams.
/// ´claim:server:multipart-operations-has-the-json-ceiling´
#[sqlx::test(migrations = "../../migrations")]
async fn an_oversized_multipart_operations_field_is_refused_while_it_streams(pool: PgPool) {
    let opening = format!(
        "{}{{\"query\":\"{{ __typename }}#",
        part_opening("operations")
    );
    let (response, pulled) =
        post_endless_multipart(small_upload_app(pool), opening.into_bytes(), &[b'x'; 8192]).await;
    assert!(
        pulled <= PULLED_BEFORE_REFUSAL,
        "the server pulled {pulled} bytes of an endless operations field"
    );
    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(body_json(response).await["code"], "PAYLOAD_TOO_LARGE");
}

/// The same holds for the `map` field: past the JSON ceiling it is
/// refused with 413 while it streams.
///
/// A multipart map field past the JSON ceiling is refused with 413 while it streams.
/// ´claim:server:multipart-map-has-the-json-ceiling´
#[sqlx::test(migrations = "../../migrations")]
async fn an_oversized_multipart_map_field_is_refused_while_it_streams(pool: PgPool) {
    let operations = serde_json::json!({ "query": "{ __typename }" });
    let opening = format!(
        "{}{operations}\r\n{}{{\"0\":[\"",
        part_opening("operations"),
        part_opening("map"),
    );
    let (response, pulled) =
        post_endless_multipart(small_upload_app(pool), opening.into_bytes(), &[b'x'; 8192]).await;
    assert!(
        pulled <= PULLED_BEFORE_REFUSAL,
        "the server pulled {pulled} bytes of an endless map field"
    );
    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(body_json(response).await["code"], "PAYLOAD_TOO_LARGE");
}

/// A part header block that never ends is held by the multipart parser
/// until its blank line arrives, outside any field's limit, so it answers
/// to the envelope's own budget: refused with 413 while it streams.
///
/// A multipart part header block that never ends is refused with 413 while it streams.
/// ´claim:server:multipart-headers-are-bounded´
#[sqlx::test(migrations = "../../migrations")]
async fn an_endless_multipart_part_header_is_refused_while_it_streams(pool: PgPool) {
    let opening =
        format!("--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"operations\"\r\nX-Pad: ");
    let (response, pulled) =
        post_endless_multipart(small_upload_app(pool), opening.into_bytes(), &[b'a'; 8192]).await;
    assert!(
        pulled <= PULLED_BEFORE_REFUSAL,
        "the server pulled {pulled} bytes of an endless part header"
    );
    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(body_json(response).await["code"], "PAYLOAD_TOO_LARGE");
}

/// An envelope of endless tiny parts — each one empty and none of them a
/// file — is bounded by the envelope's budget rather than read up to the
/// upload ceiling.
///
/// An endless run of tiny multipart parts is refused with 413 while it streams.
/// ´claim:server:multipart-part-count-is-bounded´
#[sqlx::test(migrations = "../../migrations")]
async fn an_endless_run_of_tiny_multipart_parts_is_refused_while_it_streams(pool: PgPool) {
    const TINY_PART: &[u8] =
        b"--cogra-test-boundary\r\nContent-Disposition: form-data; name=\"x\"\r\n\r\n\r\n";
    let (response, pulled) =
        post_endless_multipart(small_upload_app(pool), Vec::new(), TINY_PART).await;
    assert!(
        pulled <= PULLED_BEFORE_REFUSAL,
        "the server pulled {pulled} bytes of endless tiny parts"
    );
    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(body_json(response).await["code"], "PAYLOAD_TOO_LARGE");
}

/// One request carries at most one file. Every file part is spooled to
/// a temporary file held open until the request ends, so a file count
/// bounded only by bytes would let one request hold a descriptor per
/// tiny part; the second file part is refused as a malformed envelope
/// before it is spooled.
///
/// A multipart request with a second file part is refused as malformed.
/// ´claim:server:multipart-carries-one-file´
#[sqlx::test(migrations = "../../migrations")]
async fn a_second_multipart_file_is_refused(pool: PgPool) {
    let file = |name: &str| {
        format!(
            "--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"{name}\"; filename=\"a.webp\"\r\n\
             Content-Type: image/webp\r\n\r\nRIFF\r\n"
        )
    };
    let body = format!(
        "{}{}{}--{BOUNDARY}--\r\n",
        upload_operations_and_map(),
        file("0"),
        file("1"),
    );
    let response = small_upload_app(pool)
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/graphql")
                .header(
                    "content-type",
                    format!("multipart/form-data; boundary={BOUNDARY}"),
                )
                .body(Body::from(body))
                .expect("request"),
        )
        .await
        .expect("response");
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

/// Behind the proxy the API reads the client from the rightmost
/// `X-Forwarded-For` hop, and a request that reaches it without one —
/// a server-side render dialling the API directly — is refused as the
/// caller's fault: a 400 `BAD_INPUT` in the transport-fault shape, never
/// a 500, and never a fall back to the socket peer. A malformed header is
/// refused the same way, and a request through the proxy is served.
///
/// A request the forwarded-header source names no client address for is refused as BAD_INPUT, never answered as a server fault.
/// ´claim:server:a-missing-forwarded-address-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn a_request_without_the_forwarded_header_is_bad_input(pool: PgPool) {
    let (ctx, auth) = rig::api_context(
        pool,
        Arc::new(api::mailer::DevMailer::new(None)),
        api::ratelimit::RateLimitConfig::unlimited(),
    );
    let uploads = rig::upload_routing(&ctx);
    let app = api::app(
        api::schema::build(ctx),
        auth,
        axum_client_ip::ClientIpSource::RightmostXForwardedFor,
        uploads,
    )
    .layer(axum::Extension(axum::extract::ConnectInfo(
        std::net::SocketAddr::from(([10, 89, 0, 7], 41000)),
    )));
    let query = r#"{"query":"{ __typename }"}"#;
    let request = |forwarded: Option<&str>| {
        let mut builder = Request::builder()
            .method("POST")
            .uri("/graphql")
            .header("content-type", "application/json");
        if let Some(value) = forwarded {
            builder = builder.header("x-forwarded-for", value);
        }
        builder.body(Body::from(query)).expect("request")
    };

    for forwarded in [None, Some("not-an-address")] {
        let response = app
            .clone()
            .oneshot(request(forwarded))
            .await
            .expect("response");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{forwarded:?}");
        let json = body_json(response).await;
        assert_eq!(
            json["errors"][0]["extensions"]["code"], "BAD_INPUT",
            "{json}"
        );
        assert!(json["data"].is_null(), "{json}");
    }

    let served = app
        .oneshot(request(Some("203.0.113.9, 10.89.0.2")))
        .await
        .expect("response");
    assert_eq!(served.status(), StatusCode::OK);
    assert_eq!(body_json(served).await["data"]["__typename"], "Query");
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
    postgres_store::auth::create_invite_link(pool, uuid::Uuid::new_v4(), inviter, false, expires_at)
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

/// The check names its inviter as a public profile — the face and the
/// name Join stands its form under — and leaves every private field of
/// that account unread for an anonymous caller.
/// (´claim:server:an-invite-link-reads-anonymously´)
#[sqlx::test(migrations = "../../migrations")]
async fn invite_link_check_names_the_inviter_as_a_public_profile(pool: PgPool) {
    let link = seed_link(
        &pool,
        "inviter",
        chrono::Utc::now() + chrono::Duration::days(1),
    )
    .await;
    let data = gql(
        test_app(pool),
        format!(
            "{{ inviteLinkCheck(id: \"{link}\") {{ inviterHandle inviter {{ \
             handle displayName {{ value status }} \
             ... on User {{ avatar {{ url }} email accountState }} }} }} }}"
        ),
    )
    .await;
    let inviter = &data["inviteLinkCheck"]["inviter"];
    assert_eq!(inviter["handle"], "inviter");
    assert_eq!(inviter["handle"], data["inviteLinkCheck"]["inviterHandle"]);
    assert_eq!(inviter["displayName"]["status"], "NORMAL");
    assert!(inviter["displayName"]["value"].is_string());
    assert!(inviter["avatar"].is_null(), "no picture was ever set");
    assert!(inviter["email"].is_null(), "private to the account itself");
    assert!(
        inviter["accountState"].is_null(),
        "private to the account itself"
    );
}

/// Seeds a credentialed account and one reset link for it expiring at
/// `expires_at`, returning the link's bare token.
async fn seed_reset(
    pool: &PgPool,
    handle: &str,
    expires_at: chrono::DateTime<chrono::Utc>,
) -> String {
    let key = common::l1::client::ActorKey::generate();
    let user = uuid::Uuid::new_v4();
    let mut conn = pool.acquire().await.expect("conn");
    postgres_store::genesis::insert_actor(
        &mut conn,
        user,
        "user",
        handle,
        &key.public_key_bytes(),
        &key.address(),
    )
    .await
    .expect("actor");
    drop(conn);
    let hash = api::auth::hash_password("a strong password").expect("hash");
    postgres_store::genesis::insert_credentials(
        pool,
        user,
        &format!("{handle}@example.com"),
        &hash,
    )
    .await
    .expect("credentials");
    let secret = api::auth::new_secret();
    postgres_store::auth::create_password_reset(
        pool,
        uuid::Uuid::new_v4(),
        user,
        &secret.hash,
        expires_at,
    )
    .await
    .expect("reset");
    secret.token
}

fn reset_check(token: &str) -> String {
    format!("{{ passwordResetLinkCheck(token: \"{token}\") }}")
}

/// The reset link's check reads live while the link is, and false for a
/// link used, one past its time and a token nothing knows — one answer
/// for all three, so ResetExpired never says which happened. Reading is
/// not spending: a link checked twice still takes the new password.
///
/// A password-reset link's check reads without consuming, live only while the link can still take a new password.
/// ´claim:server:a-reset-link-check-never-consumes´
#[sqlx::test(migrations = "../../migrations")]
async fn password_reset_link_check_reads_without_consuming(pool: PgPool) {
    let live = seed_reset(
        &pool,
        "resetter",
        chrono::Utc::now() + chrono::Duration::minutes(15),
    )
    .await;
    for _ in 0..2 {
        let data = gql(test_app(pool.clone()), reset_check(&live)).await;
        assert_eq!(data["passwordResetLinkCheck"], true);
    }
    let data = gql(
        test_app(pool.clone()),
        format!(
            "mutation {{ confirmPasswordReset(input: {{ resetToken: \"{live}\", \
             newPassword: \"a fresh strong password\" }}) {{ ok userErrors {{ code }} }} }}"
        ),
    )
    .await;
    assert_eq!(data["confirmPasswordReset"]["ok"], true, "{data}");
    let data = gql(test_app(pool.clone()), reset_check(&live)).await;
    assert_eq!(data["passwordResetLinkCheck"], false, "a used link");

    let stale = seed_reset(
        &pool,
        "late",
        chrono::Utc::now() - chrono::Duration::minutes(1),
    )
    .await;
    let data = gql(test_app(pool.clone()), reset_check(&stale)).await;
    assert_eq!(
        data["passwordResetLinkCheck"], false,
        "a link past its time"
    );

    let data = gql(test_app(pool), reset_check("no-such-token")).await;
    assert_eq!(
        data["passwordResetLinkCheck"], false,
        "a token nothing knows"
    );
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

/// An authentication scheme's name is case-insensitive (RFC 9110 §11.1,
/// which RFC 6750's `Bearer` scheme inherits), so every casing of
/// `Bearer` carries the session — on the GraphQL route and on the upload
/// part route, which read the header through the same function.
///
/// The bearer scheme name is matched case-insensitively on every authenticated route.
/// ´claim:server:the-bearer-scheme-is-case-insensitive´
#[sqlx::test(migrations = "../../migrations")]
async fn the_bearer_scheme_is_case_insensitive(pool: PgPool) {
    let rig = rig::WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (alice, _) = rig.seed_member("alice", "alice@example.com").await;
    let token = rig.log_in("alice@example.com").await;
    for scheme in ["Bearer", "bearer", "BEARER"] {
        let me = rig
            .send(
                Request::builder()
                    .method("POST")
                    .uri("/graphql")
                    .header("content-type", "application/json")
                    .header("authorization", format!("{scheme} {token}"))
                    .body(Body::from(r#"{"query":"{ me { id } }"}"#))
                    .expect("request"),
            )
            .await;
        assert_eq!(me["data"]["me"]["id"], alice.to_string(), "{scheme}: {me}");

        let part = rig
            .send(
                Request::builder()
                    .method("PUT")
                    .uri(format!("/media/uploads/{}/parts/1", uuid::Uuid::new_v4()))
                    .header("authorization", format!("{scheme} {token}"))
                    .body(Body::from(vec![0u8; 16]))
                    .expect("request"),
            )
            .await;
        assert_eq!(part["code"], "NOT_FOUND", "{scheme}: {part}");
    }
}
