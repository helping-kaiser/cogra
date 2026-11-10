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
    assert_eq!(health["mirrorEpoch"], -1);
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
/// each character the six-byte JSON escape. A cap or a document growing
/// into the headroom fails here before it grows past the ceiling.
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
    assert!(
        body.len() * 3 / 2 <= JSON_CEILING,
        "the widest request is {} bytes, too close to the {JSON_CEILING}-byte ceiling",
        body.len()
    );

    let response = test_app(pool)
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
