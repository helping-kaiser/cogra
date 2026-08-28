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
    let app = api::app(
        api::schema::build(ctx),
        auth,
        ClientIpSource::ConnectInfo,
        &MediaConfig::default(),
    )
    .layer(axum::Extension(axum::extract::ConnectInfo(
        std::net::SocketAddr::from(([127, 0, 0, 1], 9999)),
    )));
    (app, standin)
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
    api::app(
        api::schema::build(ctx),
        auth,
        ClientIpSource::XRealIp,
        &MediaConfig::default(),
    )
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
