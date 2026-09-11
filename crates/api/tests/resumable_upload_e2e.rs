//! Resumable upload end to end through the real HTTP surface: the
//! GraphQL mutations that open and close a session, and the plain `PUT`
//! that carries each part, over the same router a phone talks to and the
//! same object store the resolvers write through.
//!
//! The property these tests exist for is the one jakob's dropped upload
//! named: **a blip must cost a part, not the file.** So what they check
//! is not that the happy path works — it is that the ugly paths converge.
//! A part sent twice, a part sent wrong and then right, a completion
//! called twice, a session nobody finished: each has to land in the same
//! place a clean run does, or the resumability is decorative.
//!
//! The second thing under test is that **the way in does not change what
//! may be published.** An assembled upload goes through the same sniff,
//! strip, probe and digest a single-shot upload does, so the digest a
//! resumable upload publishes must equal the digest the single-shot path
//! publishes for the same bytes, and every cap must refuse the same files
//! — including when the client's declared size said otherwise.
//!
//! Part sizes here are tiny so a sixty-byte fixture is a four-part
//! upload. The 5 MiB floor S3 puts under a non-final part is a
//! deployment concern enforced where configuration is read; what these
//! exercise is the numbering, the assembly, and the refusals, which are
//! the same at any size.

use std::sync::Arc;

use api::media::BlobStore;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use postgres_store::PgPool;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use tower::ServiceExt;
use uuid::Uuid;

mod rig;
use rig::{TestMailer, photo_with_location};

const BOUNDARY: &str = "cogra-test-boundary";

const BEGIN: &str = r#"mutation($input: BeginMediaUploadInput!) {
  beginMediaUpload(input: $input) {
    upload { id partSizeBytes partCount expiresAt }
    userErrors { code message field }
  }
}"#;

const COMPLETE: &str = r#"mutation($input: CompleteMediaUploadInput!) {
  completeMediaUpload(input: $input) {
    media { id url digest digestAlgo mimeType sizeBytes options { aspectRatio } }
    userErrors { code message field }
  }
}"#;

const ABORT: &str = r#"mutation($input: AbortMediaUploadInput!) {
  abortMediaUpload(input: $input) { aborted userErrors { code message field } }
}"#;

const UPLOAD_MEDIA: &str = r#"mutation($input: UploadMediaInput!) {
  uploadMedia(input: $input) {
    media { id digest mimeType }
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
        Self::with_media(pool, Rig::media(16))
    }

    /// The media config these suites vary: a tiny part size, so a small
    /// fixture is still a multi-part upload.
    fn media(part_size: usize) -> api::media::MediaConfig {
        api::media::MediaConfig {
            base_url: "https://media.example/bucket".into(),
            upload_part_size_bytes: part_size,
            ..Default::default()
        }
    }

    fn with_media(pool: PgPool, media: api::media::MediaConfig) -> Self {
        let standin = l1_standin::StandIn::new(pool.clone(), Default::default());
        let auth = api::auth::AuthConfig::ephemeral().expect("auth config");
        let blobs: Arc<dyn BlobStore> = Arc::new(api::media::blob::in_memory());
        let ctx = api::schema::ApiContext {
            pool: pool.clone(),
            boundary: api::l1::StandInBoundary(standin.clone()),
            funding: standin,
            auth: auth.clone(),
            mailer: Arc::new(TestMailer::default()),
            web_origin: api::mailer::WebOrigin("http://localhost:3000".into()),
            onboarding: api::onboarding::OnboardingConfig::default(),
            rate_limits: api::ratelimit::RateLimitConfig::unlimited(),
            breach: Arc::new(api::breach::DisabledCorpus),
            media,
            blobs: blobs.clone(),
        };
        let uploads = api::UploadRouting {
            pool: ctx.pool.clone(),
            blobs: ctx.blobs.clone(),
            media: ctx.media.clone(),
        };
        let schema = api::schema::build(ctx);
        Self {
            app: api::app(
                schema,
                auth,
                axum_client_ip::ClientIpSource::XRealIp,
                uploads,
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
        let json = self
            .gql(
                None,
                "mutation($input: LogInInput!) {
                   logIn(input: $input) { auth { accessToken } }
                 }",
                json!({ "input": { "email": email, "password": "a strong password" }}),
            )
            .await;
        json["data"]["logIn"]["auth"]["accessToken"]
            .as_str()
            .expect("session")
            .to_string()
    }

    /// A member with a session, which every upload here needs.
    async fn member(&self, handle: &str) -> String {
        let email = format!("{handle}@example.com");
        self.seed_member(handle, &email).await;
        self.log_in(&email).await
    }

    async fn gql(&self, token: Option<&str>, query: &str, variables: Value) -> Value {
        let body = json!({ "query": query, "variables": variables }).to_string();
        let mut builder = Request::builder()
            .method("POST")
            .uri("/graphql")
            .header("content-type", "application/json")
            .header("x-real-ip", "203.0.113.7");
        if let Some(token) = token {
            builder = builder.header("authorization", format!("Bearer {token}"));
        }
        let response = self
            .app
            .clone()
            .oneshot(builder.body(Body::from(body)).expect("request"))
            .await
            .expect("response");
        let json = body_json(response).await;
        assert!(
            json.get("errors").is_none(),
            "unexpected transport errors: {json}"
        );
        json
    }

    /// Opens a session, asserting it was granted.
    async fn begin(&self, token: &str, declared: usize, kind: &str) -> Value {
        let json = self
            .gql(
                Some(token),
                BEGIN,
                json!({ "input": { "declaredBytes": declared, "kind": kind }}),
            )
            .await;
        json["data"]["beginMediaUpload"].clone()
    }

    /// One part, as the wire carries it: the bytes are the whole body.
    async fn put_part(
        &self,
        token: &str,
        session: &str,
        part_number: u32,
        bytes: &[u8],
    ) -> (StatusCode, Value) {
        let response = self
            .app
            .clone()
            .oneshot(
                Request::builder()
                    .method("PUT")
                    .uri(format!("/media/uploads/{session}/parts/{part_number}"))
                    .header("authorization", format!("Bearer {token}"))
                    .header("x-real-ip", "203.0.113.7")
                    .body(Body::from(bytes.to_vec()))
                    .expect("request"),
            )
            .await
            .expect("response");
        let status = response.status();
        (status, body_json(response).await)
    }

    /// Every part of `file`, cut the way the session said to.
    async fn put_all_parts(&self, token: &str, session: &str, part_size: usize, file: &[u8]) {
        for (index, chunk) in file.chunks(part_size).enumerate() {
            let (status, body) = self.put_part(token, session, index as u32 + 1, chunk).await;
            assert_eq!(status, StatusCode::OK, "part {} refused: {body}", index + 1);
        }
    }

    async fn complete(&self, token: &str, session: &str) -> Value {
        let json = self
            .gql(
                Some(token),
                COMPLETE,
                json!({ "input": { "uploadId": session }}),
            )
            .await;
        json["data"]["completeMediaUpload"].clone()
    }

    /// The whole resumable round trip, for the tests that care about the
    /// result rather than the steps.
    async fn resumable_upload(&self, token: &str, file: &[u8], kind: &str) -> Value {
        let begun = self.begin(token, file.len(), kind).await;
        assert_eq!(
            begun["userErrors"].as_array().map(Vec::len),
            Some(0),
            "refused at begin: {begun}"
        );
        let session = begun["upload"]["id"].as_str().expect("session id");
        let part_size = begun["upload"]["partSizeBytes"]
            .as_u64()
            .expect("part size") as usize;
        self.put_all_parts(token, session, part_size, file).await;
        self.complete(token, session).await
    }

    /// The single-shot path, for comparison — a GraphQL multipart request
    /// built to the specification `Upload` implements.
    async fn upload_single_shot(&self, token: &str, file: &[u8]) -> Value {
        let operations = json!({
            "query": UPLOAD_MEDIA,
            "variables": { "input": { "file": null, "coverMediaId": null }},
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

fn no_errors(payload: &Value, what: &str) {
    assert_eq!(
        payload["userErrors"].as_array().map(Vec::len),
        Some(0),
        "{what}: {payload}"
    );
}

/// The whole point, executed: bytes that arrived in pieces produce
/// exactly the asset the same bytes produce in one request.
///
/// Two authors rather than one, because an author re-uploading bytes they
/// already hold resolves to the row that exists — which would prove
/// nothing about assembly.
///
/// An upload assembled from parts produces the same digest, type and shape as the same bytes sent in one request.
/// ´claim:media:an-assembled-upload-equals-a-single-shot-one´
#[sqlx::test(migrations = "../../migrations")]
async fn an_assembled_upload_matches_a_single_shot_upload(pool: PgPool) {
    let rig = Rig::new(pool);
    let piecewise = rig.member("piecewise").await;
    let whole = rig.member("whole").await;
    let file = photo_with_location();

    let begun = rig.begin(&piecewise, file.len(), "STILL").await;
    no_errors(&begun, "begin refused");
    assert_eq!(
        begun["upload"]["partCount"], 4,
        "sixty bytes cut at sixteen is four parts"
    );

    let assembled = rig.resumable_upload(&piecewise, &file, "STILL").await;
    no_errors(&assembled, "completion refused");
    let single = rig.upload_single_shot(&whole, &file).await;
    no_errors(&single, "single-shot refused");

    assert_eq!(
        assembled["media"]["digest"], single["media"]["digest"],
        "the way in must not change what is published"
    );
    assert_eq!(assembled["media"]["mimeType"], "image/webp");
    assert_eq!(assembled["media"]["options"]["aspectRatio"], "1:1");

    let id = assembled["media"]["id"].as_str().expect("id");
    let stored = rig
        .blobs
        .get(&format!("{id}.webp"))
        .await
        .expect("the object was written before the row");
    assert_eq!(
        assembled["media"]["digest"].as_str().map(str::to_string),
        Some(hex(&Sha256::digest(&stored))),
        "the published digest is the digest of the stored bytes"
    );
    assert!(
        !stored.windows(4).any(|w| w == b"EXIF"),
        "the strip ran on the assembled bytes, not around them"
    );
    assert!(
        rig.blobs
            .get(&format!(
                "uploads/{}",
                begun["upload"]["id"].as_str().expect("id")
            ))
            .await
            .is_err(),
        "the staging object is gone once the asset exists"
    );
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// A part number names a position, not an attempt.
///
/// The hard case is not a part sent twice identically — that could pass
/// by accident. It is a part sent *wrong* and then sent right: if the
/// re-send appended instead of replacing, or if our part list kept the
/// first identifier, the assembly would carry the garbage and the digest
/// would diverge.
///
/// A re-sent part replaces the one before it, so a client that retries a part it sent wrong assembles the right file.
/// ´claim:media:a-re-sent-part-replaces-itself´
#[sqlx::test(migrations = "../../migrations")]
async fn a_re_sent_part_replaces_the_one_before_it(pool: PgPool) {
    let rig = Rig::new(pool);
    let author = rig.member("retrier").await;
    let reference = rig.member("reference").await;
    let file = photo_with_location();

    let begun = rig.begin(&author, file.len(), "STILL").await;
    no_errors(&begun, "begin refused");
    let session = begun["upload"]["id"].as_str().expect("session id");
    let part_size = begun["upload"]["partSizeBytes"].as_u64().expect("size") as usize;
    let parts: Vec<&[u8]> = file.chunks(part_size).collect();

    let (status, body) = rig
        .put_part(&author, session, 2, &vec![0xAB; parts[1].len()])
        .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "the wrong bytes are still a part: {body}"
    );

    for (index, part) in parts.iter().enumerate() {
        let (status, body) = rig.put_part(&author, session, index as u32 + 1, part).await;
        assert_eq!(status, StatusCode::OK, "part {} refused: {body}", index + 1);
        assert_eq!(
            body["receivedParts"].as_array().map(Vec::len),
            Some(if index == 0 { 2 } else { index + 1 }),
            "a re-sent part is not a new part"
        );
    }

    let completed = rig.complete(&author, session).await;
    no_errors(&completed, "completion refused");
    let single = rig.upload_single_shot(&reference, &file).await;
    no_errors(&single, "single-shot refused");
    assert_eq!(
        completed["media"]["digest"], single["media"]["digest"],
        "the retry replaced the bad part rather than joining it"
    );

    let repeated = rig.complete(&author, session).await;
    no_errors(&repeated, "a retried completion refused");
    assert_eq!(
        repeated["media"]["id"], completed["media"]["id"],
        "a completion whose reply was lost is answered with the same asset"
    );
}

/// A declared size is not evidence.
///
/// The upload here is admitted at the start because the client called it
/// a video and the video cap is wide; the bytes turn out to be a still,
/// and a still answers to the still cap. If the declared kind had been
/// allowed to pick the cap that finally applied, this file would be
/// stored — which is the whole shape of lying your way past a limit.
///
/// A cap is refused at the start on the declared size and again at completion on the bytes, so a mis-declared upload cannot buy a larger allowance.
/// ´claim:media:a-declared-size-buys-no-allowance´
#[sqlx::test(migrations = "../../migrations")]
async fn caps_refuse_at_the_start_and_again_at_completion(pool: PgPool) {
    let file = photo_with_location();
    let rig = Rig::with_media(
        pool,
        api::media::MediaConfig {
            max_upload_bytes: file.len() - 1,
            ..Rig::media(16)
        },
    );
    let author = rig.member("optimist").await;

    let refused = rig.begin(&author, file.len(), "STILL").await;
    assert!(refused["upload"].is_null(), "granted: {refused}");
    assert_eq!(refused["userErrors"][0]["code"], "BAD_INPUT");
    assert_eq!(
        refused["userErrors"][0]["field"],
        json!(["declaredBytes"]),
        "the refusal names the field that was wrong"
    );

    let begun = rig.begin(&author, file.len(), "VIDEO").await;
    no_errors(&begun, "the video cap admits these bytes at the start");
    let session = begun["upload"]["id"].as_str().expect("session id");
    let part_size = begun["upload"]["partSizeBytes"].as_u64().expect("size") as usize;
    rig.put_all_parts(&author, session, part_size, &file).await;

    let completed = rig.complete(&author, session).await;
    assert!(
        completed["media"].is_null(),
        "a still admitted as a video is still a still: {completed}"
    );
    assert_eq!(completed["userErrors"][0]["code"], "BAD_INPUT");
    assert!(
        completed["userErrors"][0]["message"]
            .as_str()
            .is_some_and(|m| m.contains("larger than")),
        "the refusal is the cap's: {completed}"
    );

    let retried = rig.complete(&author, session).await;
    assert!(
        retried["media"].is_null(),
        "a refused upload is discarded, not left to be completed again: {retried}"
    );
}

/// An upload nobody finishes has to be collected, because until it is
/// aborted the store holds every part it was given and serves them to
/// nobody. A session born already expired is the same state a stale one
/// reaches, without a test that waits a day.
///
/// The sweep collects sessions past their expiry, and an abort at the client's word collects one immediately.
/// ´claim:media:an-abandoned-upload-is-collected´
#[sqlx::test(migrations = "../../migrations")]
async fn abandoned_uploads_are_collected(pool: PgPool) {
    let rig = Rig::with_media(
        pool.clone(),
        api::media::MediaConfig {
            upload_session_ttl_secs: 0.0,
            ..Rig::media(16)
        },
    );
    let author = rig.member("abandoner").await;
    let file = photo_with_location();

    let begun = rig.begin(&author, file.len(), "STILL").await;
    no_errors(&begun, "begin refused");

    let waiting = postgres_store::media::expired_upload_sessions(&pool, 10)
        .await
        .expect("expired sessions");
    assert_eq!(waiting.len(), 1, "the session is past its expiry");
    assert!(waiting[0].unfinished, "nothing was ever completed");

    api::media::resumable::sweep_expired(&pool, &rig.blobs).await;

    let swept = postgres_store::media::expired_upload_sessions(&pool, 10)
        .await
        .expect("expired sessions");
    assert!(swept.is_empty(), "the sweep collected the session row");

    let session = begun["upload"]["id"].as_str().expect("session id");
    let (status, _) = rig.put_part(&author, session, 1, &file[..16]).await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "a collected session takes no more parts"
    );
}

/// Aborting is offered so a cancelled compose releases the store's parts
/// now rather than a day from now.
///
/// An upload the client gives up on is released at once, and its session takes no more parts.
/// ´claim:media:an-aborted-upload-is-released´
#[sqlx::test(migrations = "../../migrations")]
async fn an_aborted_upload_is_released_at_once(pool: PgPool) {
    let rig = Rig::new(pool.clone());
    let author = rig.member("quitter").await;
    let file = photo_with_location();

    let begun = rig.begin(&author, file.len(), "STILL").await;
    no_errors(&begun, "begin refused");
    let session = begun["upload"]["id"].as_str().expect("session id");
    rig.put_part(&author, session, 1, &file[..16]).await;

    let aborted = rig
        .gql(
            Some(&author),
            ABORT,
            json!({ "input": { "uploadId": session }}),
        )
        .await;
    assert_eq!(aborted["data"]["abortMediaUpload"]["aborted"], true);

    let (status, _) = rig.put_part(&author, session, 2, &file[16..32]).await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "an aborted session takes no more parts"
    );
    let completed = rig.complete(&author, session).await;
    assert_eq!(
        completed["userErrors"][0]["code"], "NOT_FOUND",
        "nor can it be completed: {completed}"
    );
}

/// The part route's own refusals.
///
/// A session id is the only thing naming an upload, so the interesting
/// question is what it is *not* enough for: it is not a capability
/// another account can spend, and it does not excuse a part that is the
/// wrong size or outside the cut. Each of these would corrupt an assembly
/// if it were let through.
///
/// A part is refused unless it is the session owner's, numbered inside the cut, and exactly the size the cut dictates.
/// ´claim:media:a-part-is-checked-before-it-is-kept´
#[sqlx::test(migrations = "../../migrations")]
async fn a_part_is_refused_unless_it_fits_the_cut(pool: PgPool) {
    let rig = Rig::new(pool);
    let owner = rig.member("owner").await;
    let stranger = rig.member("stranger").await;
    let file = photo_with_location();

    let begun = rig.begin(&owner, file.len(), "STILL").await;
    no_errors(&begun, "begin refused");
    let session = begun["upload"]["id"].as_str().expect("session id");

    let (status, _) = rig.put_part(&stranger, session, 1, &file[..16]).await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "a session id is not a capability another account can spend"
    );

    let (status, body) = rig.put_part(&owner, session, 9, &file[..16]).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert_eq!(body["field"], json!(["partNumber"]));

    let (status, body) = rig.put_part(&owner, session, 1, &file[..8]).await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "a short non-final part would silently shorten the file: {body}"
    );
    assert_eq!(body["field"], json!(["part"]));

    let unauthenticated = rig
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/media/uploads/{session}/parts/1"))
                .header("x-real-ip", "203.0.113.7")
                .body(Body::from(file[..16].to_vec()))
                .expect("request"),
        )
        .await
        .expect("response");
    assert_eq!(unauthenticated.status(), StatusCode::UNAUTHORIZED);

    let incomplete = rig.complete(&owner, session).await;
    assert_eq!(
        incomplete["userErrors"][0]["code"], "BAD_INPUT",
        "nothing landed, so there is nothing to assemble: {incomplete}"
    );
}
