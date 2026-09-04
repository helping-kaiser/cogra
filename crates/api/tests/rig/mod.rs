//! ´mod:module:rig´
//!
//! The shared HTTP test rig: every integration suite builds the same
//! ApiContext and router over a throwaway database; the mailer, the
//! rate limits, and the client-IP source are the per-suite knobs.
#![allow(
    dead_code,
    reason = "compiled per test binary; each suite uses a subset of the rig"
)]

use std::sync::{Arc, Mutex};

use api::auth::AuthConfig;
use api::mailer::{Mail, Mailer, WebOrigin};
use api::media::MediaConfig;
use api::ratelimit::RateLimitConfig;
use api::schema::ApiContext;
use axum_client_ip::ClientIpSource;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::PgPool;

/// The full ApiContext over a test pool, with the ephemeral session
/// key it was built under — `api::app` wants both.
pub fn api_context(
    pool: PgPool,
    mailer: Arc<dyn Mailer>,
    rate_limits: RateLimitConfig,
) -> (ApiContext, AuthConfig) {
    let standin = StandIn::new(pool.clone(), StandInConfig::default());
    let auth = AuthConfig::ephemeral().expect("auth config");
    (
        ApiContext {
            pool,
            boundary: api::l1::StandInBoundary(standin.clone()),
            funding: standin,
            auth: auth.clone(),
            mailer,
            web_origin: WebOrigin("http://localhost:3000".into()),
            onboarding: api::onboarding::OnboardingConfig::default(),
            rate_limits,
            breach: Arc::new(api::breach::DisabledCorpus),
            media: MediaConfig::default(),
            blobs: Arc::new(api::media::blob::in_memory()),
        },
        auth,
    )
}

/// The router with a fixed socket peer. The fixed ConnectInfo stands in
/// for the peer — axum-client-ip reads the extension directly, so
/// axum's MockConnectInfo fallback (which only axum's own extractor
/// consults) does not apply here.
pub fn connect_info_app(
    pool: PgPool,
    mailer: Arc<dyn Mailer>,
    rate_limits: RateLimitConfig,
) -> axum::Router {
    connect_info_app_with_standin(pool, mailer, rate_limits).0
}

/// `connect_info_app`, also handing back the stand-in behind the
/// context for suites that drive epochs directly.
pub fn connect_info_app_with_standin(
    pool: PgPool,
    mailer: Arc<dyn Mailer>,
    rate_limits: RateLimitConfig,
) -> (axum::Router, StandIn) {
    let (ctx, auth) = api_context(pool, mailer, rate_limits);
    let standin = ctx.funding.clone();
    let uploads = upload_routing(&ctx);
    let app = api::app(
        api::schema::build(ctx),
        auth,
        ClientIpSource::ConnectInfo,
        uploads,
    )
    .layer(axum::Extension(axum::extract::ConnectInfo(
        std::net::SocketAddr::from(([127, 0, 0, 1], 9999)),
    )));
    (app, standin)
}

/// The part route's state, taken off the context the schema is about to
/// consume.
pub fn upload_routing(ctx: &api::schema::ApiContext) -> api::UploadRouting {
    api::UploadRouting {
        pool: ctx.pool.clone(),
        blobs: ctx.blobs.clone(),
        media: ctx.media.clone(),
    }
}

/// The router deriving the client IP from `X-Real-Ip`, for suites where
/// each request names its own address — varying the socket peer is
/// impossible through `oneshot`.
pub fn x_real_ip_app(
    pool: PgPool,
    mailer: Arc<dyn Mailer>,
    rate_limits: RateLimitConfig,
) -> axum::Router {
    let (ctx, auth) = api_context(pool, mailer, rate_limits);
    let uploads = upload_routing(&ctx);
    api::app(
        api::schema::build(ctx),
        auth,
        ClientIpSource::XRealIp,
        uploads,
    )
}

/// One RIFF chunk: the four-character code, the little-endian payload
/// size, the payload, and the pad byte an odd size takes.
pub fn webp_chunk(fourcc: &[u8; 4], payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(fourcc);
    out.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    out.extend_from_slice(payload);
    if payload.len() % 2 == 1 {
        out.push(0);
    }
    out
}

/// A WebP container around a chunk sequence.
pub fn webp_container(body: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&((4 + body.len()) as u32).to_le_bytes());
    out.extend_from_slice(b"WEBP");
    out.extend_from_slice(body);
    out
}

/// A 1×1 lossless WebP carrying an EXIF chunk with a location in it —
/// the shape a phone camera hands over, and the shape that must never
/// reach public storage intact.
///
/// Both upload suites want the same bytes and for the same reason: the
/// strip changes them, so a path that stored what arrived instead of
/// what the pipeline produced shows up as a different digest.
pub fn photo_with_location() -> Vec<u8> {
    let mut body = webp_chunk(b"VP8L", &[0x2F, 0x00, 0x00, 0x00, 0x00, 0x88, 0x88, 0x08]);
    body.extend_from_slice(&webp_chunk(b"EXIF", b"GPS 52.5200 N 13.4050 E"));
    webp_container(&body)
}

/// A two-frame animated WebP, built to the container specification's
/// `ANMF` layout: x, y, width-minus-one and height-minus-one as 24-bit
/// little-endian triples, then the frame duration, then a flag byte,
/// then the frame's own image chunk.
///
/// A second still that is genuinely a second still: the strip removes
/// EXIF, so two photos differing only in their location metadata
/// deduplicate to one asset.
pub fn animated_webp() -> Vec<u8> {
    let mut vp8x = vec![0x02, 0, 0, 0];
    vp8x.extend_from_slice(&[0, 0, 0]);
    vp8x.extend_from_slice(&[0, 0, 0]);
    let mut body = webp_chunk(b"VP8X", &vp8x);
    body.extend_from_slice(&webp_chunk(b"ANIM", &[0, 0, 0, 0, 0, 0]));
    for duration in [40u32, 60] {
        let mut frame = Vec::new();
        for triple in [0u32, 0, 0, 0, duration] {
            frame.extend_from_slice(&triple.to_le_bytes()[..3]);
        }
        frame.push(0);
        frame.extend_from_slice(&webp_chunk(
            b"VP8L",
            &[0x2F, 0x00, 0x00, 0x00, 0x00, 0x88, 0x88, 0x08],
        ));
        body.extend_from_slice(&webp_chunk(b"ANMF", &frame));
    }
    webp_container(&body)
}

/// Collects a response body as JSON.
pub async fn body_json(response: axum::response::Response) -> serde_json::Value {
    use http_body_util::BodyExt;
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("body")
        .to_bytes();
    serde_json::from_slice(&bytes).expect("json body")
}

/// Captures outbound mail so a test can read tokens like a user reads
/// their inbox.
#[derive(Default)]
pub struct TestMailer(Mutex<Vec<Mail>>);

impl Mailer for TestMailer {
    fn send(
        &self,
        mail: Mail,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + '_>> {
        Box::pin(async move {
            self.0.lock().expect("mailbox").push(mail);
        })
    }
}

impl TestMailer {
    pub fn count(&self) -> usize {
        self.0.lock().expect("mailbox").len()
    }

    /// Every subject sent to an address, in send order.
    pub fn subjects_for(&self, to: &str) -> Vec<String> {
        self.0
            .lock()
            .expect("mailbox")
            .iter()
            .filter(|m| m.to == to)
            .map(|m| m.subject.clone())
            .collect()
    }

    /// The token out of the newest message to `to` — read from the
    /// link's `token=` parameter (auth.md "Link URLs").
    pub fn latest_token_for(&self, to: &str) -> String {
        let mails = self.0.lock().expect("mailbox");
        let mail = mails
            .iter()
            .rev()
            .find(|m| m.to == to)
            .unwrap_or_else(|| panic!("no mail for {to}"));
        mail.body
            .lines()
            .find_map(|l| l.split("token=").nth(1))
            .expect("token line")
            .trim()
            .to_string()
    }
}
