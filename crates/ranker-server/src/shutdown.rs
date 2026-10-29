//! ´mod:module:shutdown´
//!
//! Stopping the pod on SIGTERM or SIGINT without cutting a rank off
//! mid-answer: axum's `with_graceful_shutdown` on a `CancellationToken`
//! the signal cancels (tokio.rs "Graceful Shutdown"), bounded by
//! [`GRACE`]. The pod holds no state, so a drained server is the whole of
//! its shutdown.
//!
//! The api's `shutdown` module is the same pattern with the ingest
//! workers added; the pod cannot share it, since the pod never links the
//! api (PR-9) and the api never links the pod.

use std::time::Duration;

use axum::Router;
use tokio_util::sync::CancellationToken;

/// How long open requests have, from the signal, before they are let go.
/// Below the unit's `--stop-timeout=10` (deploy/quadlet/cogra-ranker.container),
/// so the pod exits on its own rather than by SIGKILL.
pub const GRACE: Duration = Duration::from_secs(7);

/// The two signals that stop the pod: SIGTERM from the container runtime,
/// SIGINT from a terminal's Ctrl-C.
pub struct Signals {
    #[cfg(unix)]
    terminate: tokio::signal::unix::Signal,
    #[cfg(unix)]
    interrupt: tokio::signal::unix::Signal,
}

impl Signals {
    /// Installs the handlers; from here on the signals are the pod's to
    /// act on.
    pub fn install() -> std::io::Result<Self> {
        #[cfg(unix)]
        {
            use tokio::signal::unix::{SignalKind, signal};
            Ok(Self {
                terminate: signal(SignalKind::terminate())?,
                interrupt: signal(SignalKind::interrupt())?,
            })
        }
        #[cfg(not(unix))]
        {
            Ok(Self {})
        }
    }

    /// Waits for the first of them and names it.
    pub async fn recv(&mut self) -> &'static str {
        #[cfg(unix)]
        {
            tokio::select! {
                _ = self.terminate.recv() => "SIGTERM",
                _ = self.interrupt.recv() => "SIGINT",
            }
        }
        #[cfg(not(unix))]
        {
            match tokio::signal::ctrl_c().await {
                Ok(()) => "Ctrl-C",
                Err(e) => {
                    tracing::error!(error = %e, "no Ctrl-C handler; the pod stops only when killed");
                    std::future::pending().await
                }
            }
        }
    }

    /// Cancels `token` on the first signal, logging which one arrived.
    pub fn cancel_on_signal(mut self, token: CancellationToken) {
        tokio::spawn(async move {
            let signal = self.recv().await;
            tracing::info!(
                signal,
                grace_secs = GRACE.as_secs(),
                "shutdown: draining open requests"
            );
            token.cancel();
        });
    }
}

/// How a drain ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Drained {
    /// Every open request finished.
    Clean,
    /// The grace ran out first; what was still open was let go.
    DeadlinePassed,
}

/// Serves `router` until `token` is cancelled, then lets the open requests
/// finish for at most `grace`.
///
/// axum's graceful shutdown stops accepting at the signal and then waits
/// for every open connection without bound; a rank stuck on a slow slice
/// read would hold the pod past its stop timeout. The grace is that bound.
pub async fn serve_until(
    listener: tokio::net::TcpListener,
    router: Router,
    token: CancellationToken,
    grace: Duration,
) -> std::io::Result<Drained> {
    let server =
        axum::serve(listener, router).with_graceful_shutdown(token.clone().cancelled_owned());
    tokio::select! {
        served = server.into_future() => served.map(|()| Drained::Clean),
        () = async {
            token.cancelled().await;
            tokio::time::sleep(grace).await;
        } => Ok(Drained::DeadlinePassed),
    }
}
