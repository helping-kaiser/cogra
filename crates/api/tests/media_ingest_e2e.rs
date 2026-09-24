//! The media ingest path end to end: an upload outside the served target
//! lands `PROCESSING`, prepare refuses it, the worker settles it, and only
//! then may it be attached — through the real HTTP surface and the same
//! object store the resolvers write through.
//!
//! What is under test is the ordering the witness guarantee rests on: the
//! envelope commits an asset's digest at prepare, so the bytes behind any
//! digest that can be committed must already be final. Every assertion
//! here is a way of checking that no committable digest is ever replaced.
//!
//! **ffmpeg.** The re-encode itself needs ffmpeg on `PATH`. The tests that
//! drive it skip with a `SKIPPED` line when it is absent, and fail instead
//! when `CI` is set — CI installs it, so a skip there would be a gate that
//! silently stopped gating. Everything else here runs without it.

use std::sync::Arc;
use std::time::Duration;

use api::media::ingest_queue::{self as ingest, IngestSettings, Settled};
use api::media::transcode::Ffmpeg;
use api::media::{BlobStore, GalleryKind};
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

const MEDIA_FIELDS: &str =
    "id url digest sizeBytes mimeType state failureReason options { aspectRatio durationMs }";

struct Rig {
    app: axum::Router,
    pool: PgPool,
    standin: l1_standin::StandIn,
    blobs: Arc<dyn BlobStore>,
    media: api::media::MediaConfig,
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
        let ctx = api::schema::ApiContext {
            pool: pool.clone(),
            boundary: api::l1::StandInBoundary(standin.clone()),
            funding: standin.clone(),
            auth: auth.clone(),
            mailer: Arc::new(TestMailer::default()),
            web_origin: api::mailer::WebOrigin("http://localhost:3000".into()),
            onboarding: api::onboarding::OnboardingConfig::default(),
            rate_limits: api::ratelimit::RateLimitConfig::unlimited(),
            breach: Arc::new(api::breach::DisabledCorpus),
            media: media.clone(),
            blobs: blobs.clone(),
        };
        let uploads = rig::upload_routing(&ctx);
        let schema = api::schema::build(ctx);
        Self {
            app: api::app(
                schema,
                auth,
                axum_client_ip::ClientIpSource::XRealIp,
                uploads,
            ),
            pool,
            standin,
            blobs,
            media,
        }
    }

    /// A member funded with enough θ for the prepares below: one that
    /// passes the gallery rules is then priced like any other act.
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
        self.standin
            .credit_burn(&key.address(), 10_000_000)
            .await
            .expect("burn");
        id
    }

    async fn gql(&self, token: Option<&str>, query: &str, variables: Value) -> Value {
        let mut request = Request::builder()
            .method("POST")
            .uri("/graphql")
            .header("content-type", "application/json")
            .header("x-real-ip", "203.0.113.7");
        if let Some(token) = token {
            request = request.header("authorization", format!("Bearer {token}"));
        }
        let body = json!({ "query": query, "variables": variables }).to_string();
        let response = self
            .app
            .clone()
            .oneshot(request.body(Body::from(body)).expect("request"))
            .await
            .expect("response");
        let json = rig::body_json(response).await;
        assert!(json.get("errors").is_none(), "unexpected errors: {json}");
        json["data"].clone()
    }

    async fn log_in(&self, email: &str) -> String {
        let data = self
            .gql(
                None,
                "mutation($input: LogInInput!) { logIn(input: $input) { auth { accessToken } } }",
                json!({ "input": { "email": email, "password": "a strong password" }}),
            )
            .await;
        data["logIn"]["auth"]["accessToken"]
            .as_str()
            .expect("session")
            .to_string()
    }

    /// One `uploadMedia` multipart request (the GraphQL multipart request
    /// specification): operations, map, and the binary part.
    async fn upload(&self, token: &str, file: &[u8]) -> Value {
        self.upload_input(token, file, json!({ "file": null }))
            .await
    }

    /// An upload headed for a named destination.
    async fn upload_for(&self, token: &str, file: &[u8], scale: &str) -> Value {
        self.upload_input(token, file, json!({ "file": null, "scale": scale }))
            .await
    }

    async fn upload_input(&self, token: &str, file: &[u8], input: Value) -> Value {
        let query = format!(
            "mutation($input: UploadMediaInput!) {{ uploadMedia(input: $input) {{ \
             media {{ {MEDIA_FIELDS} }} userErrors {{ code message field }} }} }}"
        );
        let operations = json!({ "query": query, "variables": { "input": input }}).to_string();
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
            "Content-Disposition: form-data; name=\"0\"; filename=\"clip.mp4\"\r\n\
             Content-Type: video/mp4",
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
        let bytes = response
            .into_body()
            .collect()
            .await
            .expect("body")
            .to_bytes();
        let json: Value = serde_json::from_slice(&bytes).expect("json");
        assert!(json.get("errors").is_none(), "unexpected errors: {json}");
        let uploaded = json["data"]["uploadMedia"].clone();
        assert_eq!(
            uploaded["userErrors"].as_array().map(Vec::len),
            Some(0),
            "refused: {uploaded}"
        );
        uploaded["media"].clone()
    }

    async fn media_attachment(&self, token: &str, id: &str) -> Value {
        let query =
            format!("query($id: UUID!) {{ mediaAttachment(id: $id) {{ {MEDIA_FIELDS} }} }}");
        self.gql(Some(token), &query, json!({ "id": id })).await["mediaAttachment"].clone()
    }

    /// A video post naming one asset, returning the prepare's user errors.
    async fn prepare_video_post(&self, token: &str, media_id: &str) -> Value {
        let data = self
            .gql(
                Some(token),
                "mutation($input: PreparePostInput!) { preparePost(input: $input) { \
                   node userErrors { code message field } } }",
                json!({ "input": {
                    "title": "A clip",
                    "license": { "attribution": 1.0, "provenance": 0.0 },
                    "attachments": [{ "mediaId": media_id, "displayOrder": 0 }],
                }}),
            )
            .await;
        data["preparePost"]["userErrors"].clone()
    }

    fn settings(&self) -> IngestSettings {
        IngestSettings {
            lease: Duration::from_secs(60),
            poll: Duration::from_secs(1),
            deadline: Duration::from_secs(120),
            retry_after: Duration::from_secs(30),
        }
    }

    async fn ingest(&self, ffmpeg: Option<&Ffmpeg>) -> Settled {
        ingest::ingest_once(
            &self.pool,
            self.blobs.as_ref(),
            &self.media,
            ffmpeg,
            self.settings(),
        )
        .await
        .expect("an ingest pass")
    }
}

/// A real MP4 carrying one H.264 track of the given canvas and one tiny
/// sample — enough for the probe, which reads the header alone, and far
/// from anything a decoder would accept.
fn h264_movie(width: u16, height: u16, sample_ms: u32) -> Vec<u8> {
    let config = mp4::Mp4Config {
        major_brand: "isom".parse().expect("a brand"),
        minor_version: 512,
        compatible_brands: vec![
            "isom".parse().expect("a brand"),
            "mp41".parse().expect("a brand"),
        ],
        timescale: 1000,
    };
    let mut writer = mp4::Mp4Writer::write_start(std::io::Cursor::new(Vec::new()), &config)
        .expect("the writer starts");
    writer
        .add_track(&mp4::TrackConfig {
            track_type: mp4::TrackType::Video,
            timescale: 1000,
            language: "und".into(),
            media_conf: mp4::MediaConfig::AvcConfig(mp4::AvcConfig {
                width,
                height,
                seq_param_set: vec![0x67, 0x42, 0x00, 0x1E, 0x00],
                pic_param_set: vec![0x68, 0xCE, 0x3C, 0x80],
            }),
        })
        .expect("a track");
    writer
        .write_sample(
            1,
            &mp4::Mp4Sample {
                start_time: 0,
                duration: sample_ms,
                rendering_offset: 0,
                is_sync: true,
                bytes: bytes::Bytes::from_static(&[0, 0, 0, 1]),
            },
        )
        .expect("a sample");
    writer.write_end().expect("the writer finishes");
    writer.into_writer().into_inner()
}

/// The ffmpeg on `PATH`, or `None` with a visible skip — except under CI,
/// where its absence is a broken gate rather than a missing convenience.
async fn ffmpeg_or_skip(test: &str) -> Option<Ffmpeg> {
    match Ffmpeg::detect("ffmpeg").await {
        Ok(ffmpeg) => Some(ffmpeg),
        Err(e) if std::env::var_os("CI").is_some() => {
            panic!("ffmpeg is required under CI ({test}): {e}")
        }
        Err(e) => {
            eprintln!("SKIPPED {test}: ffmpeg unavailable ({e}); install ffmpeg to run it");
            None
        }
    }
}

/// A camera-original-shaped clip: 2560 × 1440 at 12 Mbps with sound, two
/// seconds long, carrying a title and a location in its container
/// metadata — everything the served target removes.
async fn camera_original(ffmpeg: &Ffmpeg) -> Vec<u8> {
    let scratch = tempfile::tempdir().expect("scratch");
    let out = scratch.path().join("original.mp4");
    let status = tokio::process::Command::new(ffmpeg.program())
        .args([
            "-nostdin",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=2560x1440:rate=30",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=48000",
            "-t",
            "2",
            "-c:v",
            ffmpeg.h264_encoder(),
            "-b:v",
            "12000000",
            "-c:a",
            "aac",
            "-metadata",
            "title=grandmas-house",
            "-metadata",
            "location=+52.5200+013.4050/",
            "-shortest",
        ])
        .arg(&out)
        .status()
        .await
        .expect("ffmpeg runs");
    assert!(status.success(), "the fixture encodes");
    tokio::fs::read(&out).await.expect("the fixture")
}

/// A phone-shaped clip — small canvas, low rate, well within target on
/// video alone — carrying audio in `audio_codec` rather than AAC. Used to
/// prove the widened acceptance: the upload queues on audio's account
/// alone, and the ingest worker's fixed recipe turns whatever this is
/// into AAC without touching the video, which video alone being in
/// target lets it copy ([`api::media::transcode::VideoPlan`]).
async fn non_aac_audio_original(ffmpeg: &Ffmpeg, audio_codec: &str) -> Vec<u8> {
    let scratch = tempfile::tempdir().expect("scratch");
    let out = scratch.path().join("original.mp4");
    let status = tokio::process::Command::new(ffmpeg.program())
        .args([
            "-nostdin",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=640x360:rate=30",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=48000",
            "-t",
            "2",
            "-c:v",
            ffmpeg.h264_encoder(),
            "-b:v",
            "600000",
            "-c:a",
            audio_codec,
            "-shortest",
        ])
        .arg(&out)
        .status()
        .await
        .expect("ffmpeg runs");
    assert!(status.success(), "the {audio_codec} fixture encodes");
    tokio::fs::read(&out).await.expect("the fixture")
}

/// The ffmpeg on `PATH` if it can also tone-map, on the same skip-or-fail
/// terms as [`ffmpeg_or_skip`]: CI's ffmpeg carries zimg, so a missing
/// tone map there is a broken gate too.
async fn tone_mapping_ffmpeg_or_skip(test: &str) -> Option<Ffmpeg> {
    let ffmpeg = ffmpeg_or_skip(test).await?;
    if ffmpeg.tone_maps() {
        return Some(ffmpeg);
    }
    if std::env::var_os("CI").is_some() {
        panic!("ffmpeg must carry zscale, tonemap and h264_metadata under CI ({test})");
    }
    eprintln!("SKIPPED {test}: ffmpeg cannot tone-map (built without zimg?)");
    None
}

/// A real HDR clip: two seconds of test pattern at 1280 × 720 with sound,
/// converted by zscale into BT.2020 with the given transfer — so the
/// samples are genuinely PQ- or HLG-coded, diffuse white at BT.2408's
/// 203 cd/m² — and tagged so in the H.264 VUI by `h264_metadata`, which
/// is where a camera states it. Eight-bit, because that is what every
/// encoder the tests may meet can produce, and at 3 Mbps, inside the rate
/// target: only the signal puts it outside.
async fn hdr_original(ffmpeg: &Ffmpeg, zscale_transfer: &str, h273_code: u8) -> Vec<u8> {
    let scratch = tempfile::tempdir().expect("scratch");
    let out = scratch.path().join("hdr.mp4");
    let status = tokio::process::Command::new(ffmpeg.program())
        .args([
            "-nostdin",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=1280x720:rate=30",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=48000",
            "-t",
            "2",
            "-vf",
            &format!(
                "zscale=tin=bt709:pin=bt709:min=bt709:t={zscale_transfer}:p=bt2020\
                 :m=bt2020nc:npl=203,format=yuv420p"
            ),
            "-c:v",
            ffmpeg.h264_encoder(),
            "-b:v",
            "3000000",
            "-bsf:v",
            &format!(
                "h264_metadata=colour_primaries=9:transfer_characteristics={h273_code}\
                 :matrix_coefficients=9"
            ),
            "-c:a",
            "aac",
            "-shortest",
        ])
        .arg(&out)
        .status()
        .await
        .expect("ffmpeg runs");
    assert!(status.success(), "the HDR fixture encodes");
    tokio::fs::read(&out).await.expect("the fixture")
}

/// What an independent reader — ffprobe, beside the ffmpeg the tests
/// drive — says about the first video stream: pixel format, transfer,
/// primaries, matrix.
async fn ffprobe_colour(bytes: &[u8]) -> String {
    let scratch = tempfile::tempdir().expect("scratch");
    let file = scratch.path().join("probe.mp4");
    tokio::fs::write(&file, bytes).await.expect("scratch file");
    let output = tokio::process::Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=pix_fmt,color_transfer,color_primaries,color_space",
            "-of",
            "default=noprint_wrappers=1",
        ])
        .arg(&file)
        .output()
        .await
        .expect("ffprobe runs");
    assert!(output.status.success(), "ffprobe reads the file");
    String::from_utf8_lossy(&output.stdout).into_owned()
}

/// An HDR upload is re-encoded even though its rate is within target, and
/// its rendition is tone-mapped SDR: 8-bit 4:2:0 BT.709, as the server's
/// own probe reads it off the SPS and as ffprobe reads it independently —
/// for PQ and for HLG alike.
///
/// An HDR upload is re-encoded to a rendition that is 8-bit 4:2:0 BT.709 SDR.
/// ´claim:media:an-hdr-upload-becomes-bt709-sdr´
#[sqlx::test(migrations = "../../migrations")]
async fn an_hdr_upload_is_tone_mapped_to_bt709_sdr(pool: PgPool) {
    let Some(ffmpeg) =
        tone_mapping_ffmpeg_or_skip("an_hdr_upload_is_tone_mapped_to_bt709_sdr").await
    else {
        return;
    };
    let rig = Rig::new(pool);
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let caps = rig.media.caps_for(GalleryKind::Post);

    for (zscale_transfer, h273_code) in [("smpte2084", 16), ("arib-std-b67", 18)] {
        let original = hdr_original(&ffmpeg, zscale_transfer, h273_code).await;
        let arrived = api::media::process(&original, caps).expect("the fixture is admitted");
        assert!(
            api::media::transcode::within_target(
                arrived.width,
                arrived.height,
                arrived.duration_ms,
                arrived.bytes.len() as u64,
                caps.video_bytes as u64,
            ),
            "{zscale_transfer}: the rate alone would pass it through"
        );

        let uploaded = rig.upload(&token, &original).await;
        assert_eq!(
            uploaded["state"], "PROCESSING",
            "{zscale_transfer}: an HDR clip is outside the target: {uploaded}"
        );
        let id = uploaded["id"].as_str().expect("id").to_string();
        assert_eq!(rig.ingest(Some(&ffmpeg)).await, Settled::Ready);

        let ready = rig.media_attachment(&token, &id).await;
        assert_eq!(ready["state"], "READY", "{ready}");
        let key = ready["url"]
            .as_str()
            .and_then(|url| url.strip_prefix("https://media.example/bucket/"))
            .expect("an asset key")
            .to_string();
        let stored = rig.blobs.get(&key).await.expect("the rendition is stored");

        let probe = api::media::process(&stored, caps).expect("the rendition validates");
        let signal = api::media::video::probe(&stored)
            .expect("the rendition probes")
            .signal
            .expect("the rendition states its signal");
        assert_eq!(
            signal.transfer,
            api::media::video::Transfer::Sdr,
            "{zscale_transfer}: tone-mapped"
        );
        assert_eq!((signal.bit_depth, signal.chroma_420), (8, true));
        assert!(!probe.needs_transcode, "the rendition is within target");

        let described = ffprobe_colour(&stored).await;
        for line in [
            "pix_fmt=yuv420p",
            "color_transfer=bt709",
            "color_primaries=bt709",
            "color_space=bt709",
        ] {
            assert!(
                described.lines().any(|l| l == line),
                "{zscale_transfer}: ffprobe reads {line}: {described}"
            );
        }
        assert_eq!(rig.prepare_video_post(&token, &id).await, json!([]));
    }
}

/// An upload whose video alone is within target but whose audio is not
/// AAC still queues, and the ingest worker's fixed recipe turns its
/// audio into AAC while leaving the video copied — the widened
/// acceptance a fallback browser upload needs: its remux can leave
/// audio in whatever the browser produced (PCM, Opus, ...) even when the
/// video track itself needed no help.
///
/// A video whose audio alone is outside target still uploads as PROCESSING and settles with AAC audio.
/// ´claim:media:non-aac-audio-alone-still-queues-and-settles´
#[sqlx::test(migrations = "../../migrations")]
async fn non_aac_audio_alone_queues_and_settles_with_aac(pool: PgPool) {
    let Some(ffmpeg) = ffmpeg_or_skip("non_aac_audio_alone_queues_and_settles_with_aac").await
    else {
        return;
    };
    let rig = Rig::new(pool);
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let caps = rig.media.caps_for(GalleryKind::Post);

    for audio_codec in ["pcm_s16le", "libopus"] {
        let original = non_aac_audio_original(&ffmpeg, audio_codec).await;
        let probe = api::media::video::probe(&original).expect("the fixture probes");
        assert!(
            api::media::transcode::within_target(
                probe.width,
                probe.height,
                probe.duration_ms,
                original.len() as u64,
                caps.video_bytes as u64,
            ),
            "{audio_codec}: the video alone is within target"
        );
        assert!(
            !probe.audio_aac,
            "{audio_codec}: this is exactly the non-AAC audio under test"
        );

        let uploaded = rig.upload(&token, &original).await;
        assert_eq!(
            uploaded["state"], "PROCESSING",
            "{audio_codec}: audio alone queues it: {uploaded}"
        );
        let id = uploaded["id"].as_str().expect("id").to_string();
        assert_eq!(rig.ingest(Some(&ffmpeg)).await, Settled::Ready);

        let ready = rig.media_attachment(&token, &id).await;
        assert_eq!(ready["state"], "READY", "{audio_codec}: {ready}");
        let key = ready["url"]
            .as_str()
            .and_then(|url| url.strip_prefix("https://media.example/bucket/"))
            .expect("an asset key")
            .to_string();
        let stored = rig.blobs.get(&key).await.expect("the rendition is stored");

        let rendition = api::media::video::probe(&stored).expect("the rendition probes");
        assert!(
            rendition.audio_aac,
            "{audio_codec}: the rendition's audio is AAC"
        );
        assert_eq!(
            (rendition.width, rendition.height),
            (probe.width, probe.height),
            "{audio_codec}: the video was copied, not rescaled"
        );

        let processed = api::media::process(&stored, caps).expect("the rendition validates");
        assert!(
            !processed.needs_transcode,
            "{audio_codec}: the rendition is within target"
        );

        assert_eq!(rig.prepare_video_post(&token, &id).await, json!([]));
    }
}

/// A clip within target is `READY` from the upload's own answer: the
/// probe the upload runs anyway is the whole cost, and the asset is
/// attachable at once. One outside it is `PROCESSING`, kept under the
/// ingest prefix, and refused by prepare at the field that named it.
///
/// An over-target video uploads as PROCESSING and prepare refuses it until its bytes are final.
/// ´claim:media:an-over-target-video-is-processing-until-final´
#[sqlx::test(migrations = "../../migrations")]
async fn an_over_target_upload_is_not_attachable_until_ready(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let lean = rig.upload(&token, &h264_movie(1080, 1920, 2_500)).await;
    assert_eq!(lean["state"], "READY", "within target: {lean}");
    assert!(lean["failureReason"].is_null());
    let lean_id = lean["id"].as_str().expect("id");
    assert_eq!(
        lean["url"],
        format!("https://media.example/bucket/{lean_id}.mp4")
    );

    let wide = rig.upload(&token, &h264_movie(2560, 1440, 2_500)).await;
    assert_eq!(
        wide["state"], "PROCESSING",
        "1440 on the short side: {wide}"
    );
    let wide_id = wide["id"].as_str().expect("id");
    assert!(
        rig.blobs
            .exists(&format!("ingest/{wide_id}.mp4"))
            .await
            .expect("head"),
        "the upload waits under the ingest prefix"
    );

    let refused = rig.prepare_video_post(&token, wide_id).await;
    assert_eq!(refused[0]["field"], json!(["attachments", "0", "mediaId"]));
    assert_eq!(refused[0]["message"], api::media::NOT_READY_MESSAGE);

    let staged: i64 = sqlx::query_scalar("SELECT count(*) FROM staged_writes")
        .fetch_one(&rig.pool)
        .await
        .expect("count");
    assert_eq!(staged, 0, "a refused prepare stages nothing");
}

/// `mediaAttachment` is how a client polls: the author reads its own
/// upload's state, and nobody else reads anything — an upload is not
/// public until a parent carries it.
///
/// Only the uploader can poll an asset's state.
/// ´claim:media:only-the-uploader-polls-an-asset´
#[sqlx::test(migrations = "../../migrations")]
async fn the_uploader_polls_its_own_asset_and_nobody_else_can(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_member("author", "author@example.com").await;
    rig.seed_member("other", "other@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let other = rig.log_in("other@example.com").await;

    let wide = rig.upload(&token, &h264_movie(2560, 1440, 2_500)).await;
    let id = wide["id"].as_str().expect("id");

    assert_eq!(
        rig.media_attachment(&token, id).await["state"],
        "PROCESSING"
    );
    assert!(rig.media_attachment(&other, id).await.is_null());
    let anonymous = rig
        .gql(
            None,
            "query($id: UUID!) { mediaAttachment(id: $id) { id } }",
            json!({ "id": id }),
        )
        .await;
    assert!(anonymous["mediaAttachment"].is_null());
}

/// A retried upload of an over-target file is the asset it already made,
/// so one file never becomes two transcodes.
///
/// A retried over-target upload resolves to the asset it already produced.
/// ´claim:media:a-retried-over-target-upload-is-one-asset´
#[sqlx::test(migrations = "../../migrations")]
async fn a_retried_over_target_upload_is_the_same_asset(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let clip = h264_movie(2560, 1440, 2_500);
    let first = rig.upload(&token, &clip).await;
    let second = rig.upload(&token, &clip).await;
    assert_eq!(first["id"], second["id"]);

    let rows: i64 = sqlx::query_scalar("SELECT count(*) FROM media_attachments")
        .fetch_one(&rig.pool)
        .await
        .expect("count");
    assert_eq!(rows, 1);
}

/// The destination an upload names is the one its job is planned for: a
/// comment clip waiting to be re-encoded is claimed as a comment job, and
/// one that named no destination as a post's.
///
/// An over-target upload's ingest job carries the destination the upload named.
/// ´claim:media:an-ingest-job-knows-its-destination´
#[sqlx::test(migrations = "../../migrations")]
async fn an_ingest_job_carries_the_destination_its_upload_named(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let reply = rig
        .upload_for(&token, &h264_movie(2560, 1440, 2_500), "COMMENT")
        .await;
    assert_eq!(reply["state"], "PROCESSING");
    let post = rig.upload(&token, &h264_movie(1440, 2560, 2_500)).await;
    assert_eq!(post["state"], "PROCESSING");

    let first = postgres_store::media::claim_ingest(&rig.pool, 60.0)
        .await
        .expect("claim")
        .expect("a job");
    let second = postgres_store::media::claim_ingest(&rig.pool, 60.0)
        .await
        .expect("claim")
        .expect("a job");
    for job in [first, second] {
        let expected = if job.id.to_string() == reply["id"].as_str().expect("id") {
            postgres_store::media::MediaScale::Comment
        } else {
            postgres_store::media::MediaScale::Post
        };
        assert_eq!(job.scale, expected, "job {}", job.id);
    }
}

/// Without an encoder the job fails rather than hanging: the author reads
/// why, the upload's bytes are released, and — because a failed asset
/// holds its digest no longer — uploading the same file again is a fresh
/// attempt rather than the failure handed back.
///
/// A job that cannot run fails with a reason, and the same file can be uploaded again.
/// ´claim:media:a-failed-upload-says-why-and-can-be-retried´
#[sqlx::test(migrations = "../../migrations")]
async fn an_upload_the_server_cannot_encode_fails_with_a_reason(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let clip = h264_movie(2560, 1440, 2_500);
    let first = rig.upload(&token, &clip).await;
    let id = first["id"].as_str().expect("id");

    assert_eq!(
        rig.ingest(None).await,
        Settled::Failed(ingest::REASON_NO_ENCODER.into())
    );
    let polled = rig.media_attachment(&token, id).await;
    assert_eq!(polled["state"], "FAILED");
    assert_eq!(polled["failureReason"], ingest::REASON_NO_ENCODER);
    assert!(
        !rig.blobs
            .exists(&format!("ingest/{id}.mp4"))
            .await
            .expect("head"),
        "a failed upload's bytes are released"
    );

    let refused = rig.prepare_video_post(&token, id).await;
    assert!(
        refused[0]["message"]
            .as_str()
            .is_some_and(|m| m.contains(ingest::REASON_NO_ENCODER)),
        "prepare says why: {refused}"
    );

    let again = rig.upload(&token, &clip).await;
    assert_ne!(again["id"], first["id"], "a fresh attempt, not the failure");
    assert_eq!(again["state"], "PROCESSING");
    assert_eq!(
        rig.ingest(None).await,
        Settled::Failed(ingest::REASON_NO_ENCODER.into())
    );
    assert_eq!(rig.ingest(None).await, Settled::Idle);
}

/// A claim is a lease, not a lock held for the job's life: a worker that
/// died stops renewing, and the job is claimable again once the lease
/// lapses — which is how a restart picks up what was in flight. A job
/// that keeps dying is failed after its last attempt instead of being
/// retried forever.
///
/// An unrenewed claim lapses and the job is re-picked, up to its attempt limit.
/// ´claim:media:an-ingest-job-survives-its-worker´
#[sqlx::test(migrations = "../../migrations")]
async fn an_abandoned_job_is_picked_up_again_until_it_gives_up(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let id = rig.upload(&token, &h264_movie(2560, 1440, 2_500)).await["id"]
        .as_str()
        .expect("id")
        .to_string();

    for attempt in 1..=ingest::MAX_ATTEMPTS {
        let job = postgres_store::media::claim_ingest(&rig.pool, 0.0)
            .await
            .expect("claim")
            .expect("a worker that died holds a zero-second lease, lapsed by the next claim");
        assert_eq!(job.id.to_string(), id);
        assert_eq!(job.attempts, attempt);
    }

    let held = postgres_store::media::claim_ingest(&rig.pool, 60.0)
        .await
        .expect("claim");
    assert!(held.is_some());
    assert!(
        postgres_store::media::claim_ingest(&rig.pool, 60.0)
            .await
            .expect("claim")
            .is_none(),
        "a live lease keeps a second worker away"
    );
    sqlx::query("UPDATE media_attachments SET lease_until = now() - interval '1 second'")
        .execute(&rig.pool)
        .await
        .expect("lapse the lease");

    assert_eq!(
        rig.ingest(None).await,
        Settled::Failed(ingest::REASON_GAVE_UP.into())
    );
}

/// The whole re-encode, with a real encoder: a 1440p camera original
/// becomes a 1080p rendition, H.264 + AAC, fast-start, carrying none of
/// the source's metadata; the published digest is the digest of the
/// bytes the store now serves; the original is gone; and the asset is
/// attachable. A retried upload of the same original then resolves to
/// the finished asset rather than to a second transcode.
///
/// The rendition is the only bytes a re-encoded asset serves, and its digest is theirs.
/// ´claim:media:a-rendition-is-the-witnessed-bytes´
#[sqlx::test(migrations = "../../migrations")]
async fn an_over_target_upload_is_re_encoded_to_the_target(pool: PgPool) {
    let Some(ffmpeg) = ffmpeg_or_skip("an_over_target_upload_is_re_encoded_to_the_target").await
    else {
        return;
    };
    let rig = Rig::new(pool);
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let original = camera_original(&ffmpeg).await;
    let uploaded = rig.upload(&token, &original).await;
    assert_eq!(uploaded["state"], "PROCESSING");
    let id = uploaded["id"].as_str().expect("id").to_string();
    let arrived_digest = uploaded["digest"].clone();

    assert_eq!(rig.ingest(Some(&ffmpeg)).await, Settled::Ready);

    let ready = rig.media_attachment(&token, &id).await;
    assert_eq!(ready["state"], "READY", "{ready}");
    assert_ne!(
        ready["digest"], arrived_digest,
        "the rendition has its own digest"
    );
    assert_eq!(ready["options"]["aspectRatio"], "16:9");

    let key = ready["url"]
        .as_str()
        .and_then(|url| url.strip_prefix("https://media.example/bucket/"))
        .expect("an asset key")
        .to_string();
    let stored = rig.blobs.get(&key).await.expect("the rendition is stored");
    assert_eq!(
        ready["digest"].as_str().map(str::to_string),
        Some(hex::encode(Sha256::digest(&stored))),
        "the published digest is the digest of the served bytes"
    );
    assert_eq!(ready["sizeBytes"].as_i64(), Some(stored.len() as i64));
    assert!(
        !rig.blobs
            .exists(&format!("ingest/{id}.mp4"))
            .await
            .expect("head"),
        "the original is discarded"
    );

    let probe = api::media::process(&stored, rig.media.caps_for(GalleryKind::Post))
        .expect("the rendition validates");
    assert_eq!((probe.width, probe.height), (1920, 1080));
    assert!(!probe.needs_transcode, "the rendition is within target");
    assert_eq!(probe.bytes, stored, "nothing left for the strip to remove");
    let title = b"grandmas-house";
    assert!(!stored.windows(title.len()).any(|w| w == title));
    let at = |fourcc: &[u8; 4]| {
        stored
            .windows(4)
            .position(|w| w == fourcc)
            .expect("an MP4 box")
    };
    assert!(
        at(b"moov") < at(b"mdat"),
        "fast-start: the movie header leads the media"
    );

    let accepted = rig.prepare_video_post(&token, &id).await;
    assert_eq!(accepted, json!([]), "a ready asset is attachable");

    let retried = rig.upload(&token, &original).await;
    assert_eq!(retried["id"].as_str(), Some(id.as_str()));
    assert_eq!(retried["state"], "READY");
    assert_eq!(rig.ingest(Some(&ffmpeg)).await, Settled::Idle);
}

/// A file ffmpeg cannot decode fails with the author-facing reason, not
/// the encoder's own words — the probe accepted the header, and only the
/// encode finds out the samples are not a picture.
///
/// An upload ffmpeg refuses fails with a reason worded for its author.
/// ´claim:media:an-undecodable-upload-fails-in-the-authors-words´
#[sqlx::test(migrations = "../../migrations")]
async fn an_upload_ffmpeg_refuses_fails_in_the_authors_words(pool: PgPool) {
    let Some(ffmpeg) = ffmpeg_or_skip("an_upload_ffmpeg_refuses_fails_in_the_authors_words").await
    else {
        return;
    };
    let rig = Rig::new(pool);
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let id = rig.upload(&token, &h264_movie(2560, 1440, 2_500)).await["id"]
        .as_str()
        .expect("id")
        .to_string();
    assert_eq!(
        rig.ingest(Some(&ffmpeg)).await,
        Settled::Failed(ingest::REASON_DID_NOT_ENCODE.into())
    );
    assert_eq!(rig.media_attachment(&token, &id).await["state"], "FAILED");
}
