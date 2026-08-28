//! ´mod:module:ratelimit´
//!
//! Auth-endpoint rate limiting (auth.md "Rate limiting"): per-IP and
//! per-key fixed windows plus the login backoff.
//!
//! The state is Postgres-held (`postgres_store::rate_limit`), so limits
//! survive restarts and hold across instances. Keys that name an account
//! use the submitted, normalized email string: an unknown email consumes
//! budget exactly like a known one, so the limiter never becomes an
//! account-existence oracle (auth.md "Password reset" — success
//! regardless of existence).

use std::net::IpAddr;

use anyhow::Context;
use chrono::{DateTime, Utc};
use postgres_store::{PgPool, rate_limit as store};

/// The request's derived client IP, injected by the GraphQL handler
/// (lib.rs) from the CLIENT_IP_SOURCE-configured extractor.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RequestIp(pub IpAddr);

pub mod scope {
    //! ´mod:module:scope´
    //!
    //! One limited verb class: the scope string keys the state rows.
    pub const LOGIN_IP: &str = "login_ip";
    pub const LOGIN_EMAIL: &str = "login_email";
    pub const REGISTER_IP: &str = "register_ip";
    pub const REGISTER_LINK: &str = "register_link";
    pub const RESET_IP: &str = "reset_ip";
    pub const RESET_EMAIL: &str = "reset_email";
    pub const RESEND_EMAIL: &str = "resend_email";
    pub const CONFIRM_IP: &str = "confirm_ip";
    pub const UPLOAD_ACCOUNT: &str = "upload_account";
}

/// One fixed-window budget: at most `limit` attempts per `window_secs`.
#[derive(Debug, Clone, Copy)]
pub struct Window {
    pub limit: i32,
    pub window_secs: f64,
}

/// The thresholds (auth.md "Rate limiting" — the spec commits to which
/// endpoints are limited; these numbers are the implementation defaults,
/// env-tunable via RATE_LIMIT_* in main). Every value is a starting
/// point sized for a small network, not a calibrated constant.
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    /// Login attempts per IP, successes included.
    pub login_ip: Window,
    /// Consecutive login failures per email before the backoff bites.
    pub login_backoff_threshold: i32,
    /// First backoff delay, doubling per further failure.
    pub login_backoff_base_secs: f64,
    /// The backoff ceiling.
    pub login_backoff_cap_secs: f64,
    /// Application submits (register, applyWithInvite) per IP.
    pub register_ip: Window,
    /// Application submits per invite link.
    pub register_link: Window,
    /// Password-reset requests per IP.
    pub reset_ip: Window,
    /// Password-reset requests per submitted email — trips silently.
    pub reset_email: Window,
    /// Verification resends per submitted email — trips silently.
    pub resend_email: Window,
    /// Token confirmations (verifyEmail, confirmPasswordReset,
    /// confirmEmailChange) per IP.
    pub confirm_ip: Window,
    /// Media uploads per account. Uploading is not an act, so θ prices
    /// nothing about it and an insolvent actor can still fill the store —
    /// this is the only cost control media has.
    pub upload_account: Window,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            login_ip: Window {
                limit: 30,
                window_secs: 900.0,
            },
            login_backoff_threshold: 5,
            login_backoff_base_secs: 1.0,
            login_backoff_cap_secs: 900.0,
            register_ip: Window {
                limit: 5,
                window_secs: 3600.0,
            },
            register_link: Window {
                limit: 20,
                window_secs: 86_400.0,
            },
            reset_ip: Window {
                limit: 10,
                window_secs: 3600.0,
            },
            reset_email: Window {
                limit: 3,
                window_secs: 3600.0,
            },
            resend_email: Window {
                limit: 5,
                window_secs: 3600.0,
            },
            confirm_ip: Window {
                limit: 30,
                window_secs: 900.0,
            },
            upload_account: Window {
                limit: 60,
                window_secs: 3600.0,
            },
        }
    }
}

impl RateLimitConfig {
    /// Reads the RATE_LIMIT_* overrides on top of the defaults. Only the
    /// counts are env-tunable; window and backoff shapes change in code —
    /// a deliberate knob budget, not an omission.
    pub fn from_env() -> anyhow::Result<Self> {
        let mut cfg = Self::default();
        for (var, limit) in [
            ("RATE_LIMIT_LOGIN_PER_IP", &mut cfg.login_ip.limit),
            ("RATE_LIMIT_REGISTER_PER_IP", &mut cfg.register_ip.limit),
            ("RATE_LIMIT_REGISTER_PER_LINK", &mut cfg.register_link.limit),
            ("RATE_LIMIT_RESET_PER_IP", &mut cfg.reset_ip.limit),
            ("RATE_LIMIT_RESET_PER_EMAIL", &mut cfg.reset_email.limit),
            ("RATE_LIMIT_RESEND_PER_EMAIL", &mut cfg.resend_email.limit),
            ("RATE_LIMIT_CONFIRM_PER_IP", &mut cfg.confirm_ip.limit),
            (
                "RATE_LIMIT_UPLOAD_PER_ACCOUNT",
                &mut cfg.upload_account.limit,
            ),
        ] {
            if let Ok(raw) = std::env::var(var) {
                *limit = raw
                    .parse()
                    .with_context(|| format!("{var} must be an integer"))?;
            }
        }
        Ok(cfg)
    }

    /// A config no test can trip by accident — for rigs exercising other
    /// surfaces.
    pub fn unlimited() -> Self {
        let generous = Window {
            limit: i32::MAX,
            window_secs: 1.0,
        };
        Self {
            login_ip: generous,
            login_backoff_threshold: i32::MAX,
            login_backoff_base_secs: 0.0,
            login_backoff_cap_secs: 0.0,
            register_ip: generous,
            register_link: generous,
            reset_ip: generous,
            reset_email: generous,
            resend_email: generous,
            confirm_ip: generous,
            upload_account: generous,
        }
    }
}

/// Counts the attempt and answers whether it is within the window's
/// budget. Refused attempts count too, so hammering a tripped window
/// keeps it tripped.
pub async fn within(
    pool: &PgPool,
    scope: &str,
    key: &str,
    window: Window,
) -> Result<bool, sqlx::Error> {
    let count = store::count_in_window(pool, scope, key, window.window_secs).await?;
    Ok(count <= window.limit)
}

/// The login backoff's gate: Some(unblock time) while the email is
/// serving a delay.
pub async fn login_blocked(
    pool: &PgPool,
    email: &str,
) -> Result<Option<DateTime<Utc>>, sqlx::Error> {
    store::blocked_until(pool, scope::LOGIN_EMAIL, email).await
}

/// One consecutive login failure for the email; from the threshold on,
/// each failure doubles the delay.
pub async fn login_failed(
    pool: &PgPool,
    cfg: &RateLimitConfig,
    email: &str,
) -> Result<(), sqlx::Error> {
    store::record_failure(
        pool,
        scope::LOGIN_EMAIL,
        email,
        cfg.login_backoff_threshold,
        cfg.login_backoff_base_secs,
        cfg.login_backoff_cap_secs,
    )
    .await?;
    Ok(())
}

/// A successful login ends the consecutive-failure run.
pub async fn login_succeeded(pool: &PgPool, email: &str) -> Result<(), sqlx::Error> {
    store::clear(pool, scope::LOGIN_EMAIL, email).await
}

/// Throttle rows idle this long (and not blocking) are swept.
const IDLE_RETENTION_SECS: f64 = 7.0 * 86_400.0;

/// The periodic sweep of idle throttle rows — same shape as the account
/// reaper (onboarding.rs).
pub async fn gc_loop(pool: PgPool, interval_secs: u64) {
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval_secs));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        ticker.tick().await;
        match store::sweep_idle(&pool, IDLE_RETENTION_SECS).await {
            Ok(0) => {}
            Ok(n) => tracing::debug!(rows = n, "rate-limit GC swept idle rows"),
            Err(e) => tracing::warn!(error = %e, "rate-limit GC sweep failed"),
        }
    }
}
