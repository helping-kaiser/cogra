//! ´mod:module:boot´
//!
//! The checks a server process runs on its own configuration before it
//! serves, and the way it starts the background loops that run beside it
//! (development.md "Environment variables").
//!
//! A setting that cannot work is refused at startup rather than found
//! later: an interval of zero panics `tokio::time::interval` inside a
//! spawned loop, where nothing would have reported it, and a timeout of
//! zero fails every call it bounds. A loop that dies is logged the moment
//! it dies, because a dropped task handle swallows its panic.

use std::future::Future;

use anyhow::Context;
use axum_client_ip::ClientIpSource;
use tokio::task::JoinHandle;

/// A whole number of seconds that must be at least one.
pub fn positive_secs(var: &str, value: u64) -> anyhow::Result<u64> {
    anyhow::ensure!(value > 0, "{var} must be at least 1 second");
    Ok(value)
}

/// A number of seconds that must be finite and above zero — `f64`
/// parsing admits `NaN` and `inf`, which no duration can be.
pub fn positive_finite_secs(var: &str, value: f64) -> anyhow::Result<f64> {
    anyhow::ensure!(
        value.is_finite() && value > 0.0,
        "{var} must be a positive, finite number of seconds, got {value}"
    );
    Ok(value)
}

/// `var` read as a positive whole number of seconds, or `default` when unset.
pub fn env_positive_secs(var: &str, default: u64) -> anyhow::Result<u64> {
    let raw = crate::env_or(var, &default.to_string());
    let value = raw
        .trim()
        .parse()
        .with_context(|| format!("{var} must be a whole number of seconds"))?;
    positive_secs(var, value)
}

/// The client-IP derivation `CLIENT_IP_SOURCE` names, held to the two
/// development.md sanctions (auth.md "Rate limiting"): the socket peer,
/// or the rightmost `X-Forwarded-For` hop behind a proxy that is the sole
/// ingress. Every other source the crate offers reads a header any client
/// can set, so one would let a caller choose the address its rate-limit
/// budget is keyed by.
pub fn client_ip_source(raw: &str) -> anyhow::Result<ClientIpSource> {
    let source: ClientIpSource = raw
        .trim()
        .parse()
        .map_err(|e| anyhow::anyhow!("CLIENT_IP_SOURCE unrecognized: {e}"))?;
    anyhow::ensure!(
        matches!(
            source,
            ClientIpSource::ConnectInfo | ClientIpSource::RightmostXForwardedFor
        ),
        "CLIENT_IP_SOURCE must be ConnectInfo or RightmostXForwardedFor, got {source:?}"
    );
    Ok(source)
}

/// Whether this build refuses to start without `SESSION_SIGNING_SEED`.
///
/// A release build does: with an ephemeral key every restart signs every
/// session out, which a deployment would read as a fault, not a setting.
/// A dev build generates one, so `make dev` runs on `.env.example` as it
/// is; the same split the playground route takes.
pub const fn session_seed_required() -> bool {
    !cfg!(debug_assertions)
}

/// How a supervised background loop ended.
#[derive(Debug, PartialEq, Eq)]
pub enum LoopEnd {
    Returned,
    Panicked,
    Cancelled,
}

/// Spawns a background loop and a watcher that logs how it ended: a
/// panic at error, a cancellation at warn, a return at info — an ingest
/// worker returns when the stop it was handed fires. The returned handle
/// is the watcher's, for tests; the server drops it.
pub fn spawn_supervised<F>(name: &'static str, task: F) -> JoinHandle<LoopEnd>
where
    F: Future<Output = ()> + Send + 'static,
{
    watch(name, tokio::spawn(task))
}

/// The watcher alone, for a loop something else spawned — the ingest
/// workers ride the shutdown drain's `TaskTracker`, which waits for them
/// but reports nothing about how they ended.
pub fn watch(name: &'static str, handle: JoinHandle<()>) -> JoinHandle<LoopEnd> {
    tokio::spawn(async move {
        match handle.await {
            Ok(()) => {
                tracing::info!(task = name, "a background loop ended");
                LoopEnd::Returned
            }
            Err(e) if e.is_panic() => {
                tracing::error!(task = name, error = %e, "a background loop panicked");
                LoopEnd::Panicked
            }
            Err(e) => {
                tracing::warn!(task = name, error = %e, "a background loop was cancelled");
                LoopEnd::Cancelled
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Zero, NaN and infinity are refused; a positive count passes.
    /// ´claim:boot:an-unworkable-interval-is-refused-at-startup´
    #[test]
    fn an_unworkable_interval_is_refused() {
        assert!(positive_secs("X", 0).is_err());
        assert_eq!(positive_secs("X", 2).expect("positive"), 2);
        for bad in [0.0, -1.0, f64::NAN, f64::INFINITY] {
            assert!(positive_finite_secs("X", bad).is_err(), "{bad}");
        }
        assert_eq!(
            positive_finite_secs("X", 86_400.0).expect("finite"),
            86_400.0
        );
        let parsed = "NaN".parse::<f64>().expect("f64 parsing admits NaN");
        assert!(positive_finite_secs("X", parsed).is_err());
    }

    /// Why the check exists: a zero period panics the timer every loop
    /// ticks on (tokio documents `interval` as panicking on a zero
    /// period), and the crate parses a spoofable source as readily as a
    /// sanctioned one.
    /// (´claim:boot:an-unworkable-interval-is-refused-at-startup´)
    #[tokio::test]
    async fn the_unchecked_settings_break_as_the_audit_said() {
        let zero = tokio::spawn(async {
            tokio::time::interval(std::time::Duration::from_secs(0));
        });
        assert!(zero.await.expect_err("panics").is_panic());
        assert!("XRealIp".parse::<ClientIpSource>().is_ok());
    }

    /// The two sanctioned sources pass; a spoofable header source and an
    /// unknown name are refused.
    /// ´claim:boot:only-the-sanctioned-ip-sources-pass´
    #[test]
    fn only_the_sanctioned_ip_sources_pass() {
        assert_eq!(
            client_ip_source("ConnectInfo").expect("socket peer"),
            ClientIpSource::ConnectInfo
        );
        assert_eq!(
            client_ip_source("RightmostXForwardedFor").expect("proxy"),
            ClientIpSource::RightmostXForwardedFor
        );
        for spoofable in ["XRealIp", "TrueClientIp", "CfConnectingIp", "Nonsense"] {
            assert!(client_ip_source(spoofable).is_err(), "{spoofable}");
        }
    }

    /// A release build needs the seed; this dev test build does not.
    /// ´claim:boot:release-builds-need-the-session-seed´
    #[test]
    fn a_dev_build_runs_without_the_seed() {
        assert_eq!(session_seed_required(), !cfg!(debug_assertions));
    }

    /// A loop that panics is reported as having panicked.
    /// ´claim:boot:a-panicked-loop-is-logged´
    #[tokio::test]
    async fn a_panicked_loop_is_reported() {
        let watcher = spawn_supervised("doomed", async { panic!("the loop broke") });
        assert_eq!(watcher.await.expect("watcher"), LoopEnd::Panicked);
        let watcher = spawn_supervised("brief", async {});
        assert_eq!(watcher.await.expect("watcher"), LoopEnd::Returned);
    }
}
