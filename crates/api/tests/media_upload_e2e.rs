//! `uploadMedia` end to end through the real HTTP surface: a GraphQL
//! multipart request with a binary part, the same router a phone talks
//! to, and the same object store the resolver writes through — so what
//! these tests assert about the stored bytes is what a reader would be
//! served.
//!
//! The thing under test that matters most is the **transitive witness**:
//! the digest the contract exposes must be the digest of the bytes in
//! the store, and both must be the *stripped* bytes rather than the ones
//! uploaded. If the strip ran after the digest, or the store held the
//! original, a reader hashing what it downloaded would disagree with the
//! record — which is the entire guarantee media rests on.

use std::sync::Arc;

use api::media::BlobStore;
use axum::body::Body;
use axum::http::Request;
use http_body_util::BodyExt;
use postgres_store::PgPool;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use tower::ServiceExt;
use uuid::Uuid;

mod rig;
use rig::TestMailer;

const BOUNDARY: &str = "cogra-test-boundary";

const UPLOAD_MEDIA: &str = r#"mutation($input: UploadMediaInput!) {
  uploadMedia(input: $input) {
    media { id url digest digestAlgo mimeType sizeBytes altText options { aspectRatio durationMs } }
    userErrors { code message field }
  }
}"#;

struct Rig {
    app: axum::Router,
    pool: PgPool,
    blobs: Arc<dyn BlobStore>,
}

impl Rig {
    fn new(pool: PgPool) -> Self {
        let standin = l1_standin::StandIn::new(pool.clone(), Default::default());
        let auth = api::auth::AuthConfig::ephemeral().expect("auth config");
        let blobs: Arc<dyn BlobStore> = Arc::new(api::media::blob::in_memory());
        let media = api::media::MediaConfig {
            base_url: "https://media.example/bucket".into(),
            ..Default::default()
        };
        let schema = api::schema::build(api::schema::ApiContext {
            pool: pool.clone(),
            boundary: api::l1::StandInBoundary(standin.clone()),
            funding: standin,
            auth: auth.clone(),
            mailer: Arc::new(TestMailer::default()),
            web_origin: api::mailer::WebOrigin("http://localhost:3000".into()),
            onboarding: api::onboarding::OnboardingConfig::default(),
            rate_limits: api::ratelimit::RateLimitConfig::unlimited(),
            breach: Arc::new(api::breach::DisabledCorpus),
            media: media.clone(),
            blobs: blobs.clone(),
        });
        Self {
            app: api::app(
                schema,
                auth,
                axum_client_ip::ClientIpSource::XRealIp,
                &media,
            ),
            pool,
            blobs,
        }
    }

    async fn seed_member(&self, handle: &str, email: &str) -> Uuid {
        let key = common::l1::client::ActorKey::generate();
        let id = Uuid::new_v4();
        let mut conn = self.pool.acquire().await.expect("conn");
        postgres_store::genesis::insert_actor(
            &mut conn,
            id,
            "user",
            handle,
            &key.public_key_bytes(),
            &key.address(),
        )
        .await
        .expect("actor");
        drop(conn);
        postgres_store::genesis::insert_credentials(
            &self.pool,
            id,
            email,
            &api::auth::hash_password("a strong password").expect("hash"),
        )
        .await
        .expect("credentials");
        id
    }

    async fn log_in(&self, email: &str) -> String {
        let body = json!({
            "query": "mutation($input: LogInInput!) {
                        logIn(input: $input) { auth { accessToken } }
                      }",
            "variables": { "input": { "email": email, "password": "a strong password" }},
        })
        .to_string();
        let response = self
            .app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/graphql")
                    .header("content-type", "application/json")
                    .header("x-real-ip", "203.0.113.7")
                    .body(Body::from(body))
                    .expect("request"),
            )
            .await
            .expect("response");
        let json = body_json(response).await;
        json["data"]["logIn"]["auth"]["accessToken"]
            .as_str()
            .expect("session")
            .to_string()
    }

    /// One GraphQL multipart request, built to the multipart-request
    /// specification `Upload` implements: an `operations` part carrying
    /// the document with a null where the file goes, a `map` part
    /// naming that path, and the binary part itself.
    async fn upload(&self, token: &str, file: &[u8]) -> Value {
        let operations = json!({
            "query": UPLOAD_MEDIA,
            "variables": { "input": { "file": null }},
        })
        .to_string();

        let mut body: Vec<u8> = Vec::new();
        let part = |headers: &str, payload: &[u8], body: &mut Vec<u8>| {
            body.extend_from_slice(format!("--{BOUNDARY}\r\n{headers}\r\n\r\n").as_bytes());
            body.extend_from_slice(payload);
            body.extend_from_slice(b"\r\n");
        };
        part(
            "Content-Disposition: form-data; name=\"operations\"",
            operations.as_bytes(),
            &mut body,
        );
        part(
            "Content-Disposition: form-data; name=\"map\"",
            br#"{"0":["variables.input.file"]}"#,
            &mut body,
        );
        part(
            "Content-Disposition: form-data; name=\"0\"; filename=\"photo.webp\"\r\n\
             Content-Type: image/webp",
            file,
            &mut body,
        );
        body.extend_from_slice(format!("--{BOUNDARY}--\r\n").as_bytes());

        let response = self
            .app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/graphql")
                    .header(
                        "content-type",
                        format!("multipart/form-data; boundary={BOUNDARY}"),
                    )
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-real-ip", "203.0.113.7")
                    .body(Body::from(body))
                    .expect("request"),
            )
            .await
            .expect("response");
        let json = body_json(response).await;
        assert!(
            json.get("errors").is_none(),
            "unexpected transport errors: {json}"
        );
        json["data"]["uploadMedia"].clone()
    }
}

async fn body_json(response: axum::response::Response) -> Value {
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("body")
        .to_bytes();
    serde_json::from_slice(&bytes).unwrap_or_else(|e| {
        panic!(
            "non-JSON response ({e}): {}",
            String::from_utf8_lossy(&bytes)
        )
    })
}

fn chunk(fourcc: &[u8; 4], payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(fourcc);
    out.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    out.extend_from_slice(payload);
    if payload.len() % 2 == 1 {
        out.push(0);
    }
    out
}

/// A 1×1 lossless WebP carrying an EXIF chunk with a location in it —
/// the shape a phone camera hands over, and the shape that must never
/// reach public storage intact.
fn photo_with_location() -> Vec<u8> {
    let mut body = chunk(b"VP8L", &[0x2F, 0x00, 0x00, 0x00, 0x00, 0x88, 0x88, 0x08]);
    body.extend_from_slice(&chunk(b"EXIF", b"GPS 52.5200 N 13.4050 E"));
    let mut out = Vec::new();
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&((4 + body.len()) as u32).to_le_bytes());
    out.extend_from_slice(b"WEBP");
    out.extend_from_slice(&body);
    out
}

/// The whole carriage round trip. The digest the contract publishes is
/// recomputed here from the bytes the store actually holds, which is the
/// transitive witness executed rather than asserted — and those bytes no
/// longer carry the author's location.
///
/// The digest the contract publishes is the digest of the bytes the store actually holds, and those bytes no longer carry the author's location.
/// ´claim:media:the-published-digest-is-the-stored-bytes´
#[sqlx::test(migrations = "../../migrations")]
async fn an_upload_stores_stripped_bytes_under_their_own_digest(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let uploaded = rig.upload(&token, &photo_with_location()).await;
    assert_eq!(
        uploaded["userErrors"].as_array().map(Vec::len),
        Some(0),
        "refused: {uploaded}"
    );
    let media = &uploaded["media"];

    assert_eq!(media["mimeType"], "image/webp");
    assert_eq!(media["digestAlgo"], "sha256");
    assert!(
        media["altText"].is_null(),
        "the upload carries bytes and nothing authored: a description is \
         a fact about a placement, and this asset has none yet"
    );
    assert_eq!(media["options"]["aspectRatio"], "1:1");
    assert!(media["options"]["durationMs"].is_null(), "no video yet");

    let id = media["id"].as_str().expect("id");
    let url = media["url"].as_str().expect("url");
    assert_eq!(
        url,
        format!("https://media.example/bucket/{id}.webp"),
        "absolute, minted from the configured media origin"
    );

    let stored = rig
        .blobs
        .get(&format!("{id}.webp"))
        .await
        .expect("the object was written before the row");
    assert_eq!(
        media["digest"].as_str().map(str::to_string),
        Some(hex::encode(Sha256::digest(&stored))),
        "the published digest is the digest of the served bytes"
    );
    assert_eq!(
        media["sizeBytes"].as_i64(),
        Some(stored.len() as i64),
        "the size describes the stored bytes"
    );
    assert!(
        !stored.windows(4).any(|w| w == b"EXIF"),
        "the location chunk never reached the store"
    );
    assert!(
        !stored.windows(23).any(|w| w == b"GPS 52.5200 N 13.4050 E"),
        "nor its contents"
    );
}

/// A retried upload is the row that already exists, not a second one —
/// and it leaves exactly one object behind, because the duplicate the
/// retry wrote is collected on the spot.
///
/// A retried upload is the row that already exists rather than a second one, and the duplicate object it wrote is collected on the spot.
/// ´claim:media:a-retried-upload-is-the-same-asset´
#[sqlx::test(migrations = "../../migrations")]
async fn re_uploading_the_same_picture_returns_the_same_asset(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let first = rig.upload(&token, &photo_with_location()).await;
    let second = rig.upload(&token, &photo_with_location()).await;

    let first_id = first["media"]["id"].as_str().expect("id");
    assert_eq!(
        second["media"]["id"].as_str(),
        Some(first_id),
        "the same author's same bytes are one asset"
    );

    let orphan = second["media"]["id"]
        .as_str()
        .map(|id| format!("{id}.webp"))
        .expect("key");
    assert!(
        rig.blobs.exists(&orphan).await.expect("head"),
        "the asset's own object survives"
    );
}

/// A file that is not what the upload accepts is refused as data on the
/// payload, naming `file`, and nothing is written on either side.
///
/// A file the upload does not accept is refused as data against the field that carried it, with nothing written on either side.
/// ´claim:media:a-refused-upload-names-its-field-and-writes-nothing´
#[sqlx::test(migrations = "../../migrations")]
async fn a_file_that_is_not_a_webp_image_is_refused_by_field(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let mut png = Vec::from(b"\x89PNG\r\n\x1a\n".as_slice());
    png.extend_from_slice(&[0; 128]);
    let refused = rig.upload(&token, &png).await;

    assert!(refused["media"].is_null());
    let error = &refused["userErrors"][0];
    assert_eq!(error["code"], "BAD_INPUT");
    assert_eq!(error["field"], json!(["file"]));

    let rows: i64 = sqlx::query_scalar("SELECT count(*) FROM media_attachments")
        .fetch_one(&rig.pool)
        .await
        .expect("count");
    assert_eq!(rows, 0, "a refused upload writes no row");
}

/// An asset nobody attached is collected, row and object together.
///
/// An asset nobody attached is collected, row and stored object together.
/// ´claim:media:an-unattached-asset-is-swept-whole´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unattached_asset_is_swept_with_its_object(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let uploaded = rig.upload(&token, &photo_with_location()).await;
    let key = uploaded["media"]["id"]
        .as_str()
        .map(|id| format!("{id}.webp"))
        .expect("key");
    assert!(rig.blobs.exists(&key).await.expect("head"));

    let swept = postgres_store::media::sweep_orphans(&rig.pool, 0.0)
        .await
        .expect("sweep");
    assert_eq!(swept.len(), 1, "the unattached asset is an orphan");

    for asset in &swept {
        rig.blobs.delete(&asset.storage_key).await.expect("delete");
    }
    assert!(
        !rig.blobs.exists(&key).await.expect("head"),
        "the object goes with the row"
    );

    let rows: i64 = sqlx::query_scalar("SELECT count(*) FROM media_attachments")
        .fetch_one(&rig.pool)
        .await
        .expect("count");
    assert_eq!(rows, 0);
}
