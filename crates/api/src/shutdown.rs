//! ´mod:module:shutdown´
//!
//! Stopping on SIGTERM or SIGINT without cutting work off mid-way: the
//! pattern tokio documents (tokio.rs "Graceful Shutdown") — one
//! `CancellationToken` every part listens on, and a `TaskTracker` the
//! process waits on — with axum's `with_graceful_shutdown` for the HTTP
//! half.
//!
//! **The order.** The signal cancels the token. The server stops
//! accepting and lets the requests in flight finish; the media ingest
//! workers stop claiming and let a job in flight finish. Both get the same
//! [`GRACE`] from the signal; what has not finished by then is let go — an
//! open request is dropped with its connection, a job is handed back to
//! the queue for the next process. Only then does `main` return. Every
//! other background loop is crash-safe by design (each tick is a
//! transaction or idempotent), so it is simply dropped with the runtime.
//!
//! The handlers are installed just before the server listens, never
//! earlier: a stop that arrives during migrations or startup takes the
//! default action — the process ends at once, which is exactly right for
//! a process that has accepted no work yet.

use std::time::Duration;

use tokio_util::sync::CancellationToken;

/// How long in-flight work has, from the signal, before it is let go.
///
/// Below the container's stop timeout (`--stop-timeout=30` on the API's
/// unit, deploy/quadlet/cogra-api.container) with room left for the
/// hand-back of an interrupted ingest job, so the process ends on its own
/// rather than by SIGKILL.
pub const GRACE: Duration = Duration::from_secs(20);

/// The two signals that stop the server: SIGTERM from the container
/// runtime or systemd, SIGINT from a terminal's Ctrl-C.
pub struct Signals {
    #[cfg(unix)]
    terminate: tokio::signal::unix::Signal,
    #[cfg(unix)]
    interrupt: tokio::signal::unix::Signal,
}

impl Signals {
    /// Installs the handlers. From here on the signals are this process's
    /// to act on, so this is called only once there is work to drain.
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
                    tracing::error!(error = %e, "no Ctrl-C handler; the process stops only when killed");
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
                "shutdown: draining in-flight work"
            );
            token.cancel();
        });
    }
}

/// Resolves [`GRACE`]-many seconds after `token` is cancelled: the moment
/// in-flight work is let go.
pub async fn deadline(token: CancellationToken, grace: Duration) {
    token.cancelled().await;
    tokio::time::sleep(grace).await;
}

/// How a drain ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Drained {
    /// Everything in flight finished.
    Clean,
    /// The grace ran out first; what was still open was let go.
    DeadlinePassed,
}

/// Runs `server` — an `axum::serve(..).with_graceful_shutdown(..)` wired to
/// `token` — until it has drained after cancellation, or until the grace
/// after cancellation is over, whichever is first.
///
/// axum's graceful shutdown stops accepting at the signal and then waits
/// for every open connection, without bound; a client holding an upload
/// open would hold the process past its stop timeout. The grace is that
/// bound.
pub async fn drain<S>(
    server: S,
    token: CancellationToken,
    grace: Duration,
) -> std::io::Result<Drained>
where
    S: IntoFuture<Output = std::io::Result<()>>,
{
    let server = server.into_future();
    tokio::select! {
        served = server => served.map(|()| Drained::Clean),
        () = deadline(token, grace) => Ok(Drained::DeadlinePassed),
    }
}

/// Waits for `future`, but no longer than `grace` past `token`'s
/// cancellation — for draining the tracked tasks after the server.
pub async fn within<F: Future<Output = ()>>(
    future: F,
    token: CancellationToken,
    grace: Duration,
) -> Drained {
    tokio::select! {
        () = future => Drained::Clean,
        () = deadline(token, grace) => Drained::DeadlinePassed,
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use axum::Router;
    use axum::routing::get;
    use tokio_util::sync::CancellationToken;

    use super::{Drained, drain};

    /// A server on an ephemeral port behind the drain, and the address it
    /// listens on.
    async fn serve(
        router: Router,
        token: CancellationToken,
        grace: Duration,
    ) -> (
        std::net::SocketAddr,
        tokio::task::JoinHandle<std::io::Result<Drained>>,
    ) {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind");
        let addr = listener.local_addr().expect("local addr");
        let server =
            axum::serve(listener, router).with_graceful_shutdown(token.clone().cancelled_owned());
        (addr, tokio::spawn(drain(server, token, grace)))
    }

    /// The shutdown signal stops the server accepting while the request
    /// already in flight is answered, and the drain then reports itself
    /// clean.
    ///
    /// Cancelling the shutdown token closes the server, and a request already in flight is answered before it does.
    /// ´claim:shutdown:the-signal-drains-in-flight-requests´
    #[tokio::test]
    async fn the_signal_drains_in_flight_requests() {
        let (started_tx, started_rx) = tokio::sync::oneshot::channel::<()>();
        let started = std::sync::Mutex::new(Some(started_tx));
        let started = std::sync::Arc::new(started);
        let router = Router::new().route(
            "/slow",
            get(move || {
                let started = started.clone();
                async move {
                    if let Some(tx) = started.lock().expect("lock").take() {
                        let _ = tx.send(());
                    }
                    tokio::time::sleep(Duration::from_millis(300)).await;
                    "done"
                }
            }),
        );
        let token = CancellationToken::new();
        let (addr, server) = serve(router, token.clone(), Duration::from_secs(10)).await;

        let client = reqwest::Client::new();
        let in_flight = tokio::spawn(client.get(format!("http://{addr}/slow")).send());
        started_rx.await.expect("the request reached the handler");
        token.cancel();

        let answered = in_flight.await.expect("join").expect("answered");
        assert_eq!(answered.text().await.expect("body"), "done");
        let drained = tokio::time::timeout(Duration::from_secs(5), server)
            .await
            .expect("the server closes after its drain")
            .expect("join")
            .expect("serve");
        assert_eq!(drained, Drained::Clean);
        assert!(
            tokio::net::TcpStream::connect(addr).await.is_err(),
            "nothing accepts once the server has drained"
        );
    }

    /// A request that never finishes does not hold the process: the drain
    /// gives up when the grace is over.
    ///
    /// A request that never finishes is let go when the grace after the signal is over.
    /// ´claim:shutdown:the-grace-bounds-the-drain´
    #[tokio::test]
    async fn the_grace_bounds_the_drain() {
        let (started_tx, started_rx) = tokio::sync::oneshot::channel::<()>();
        let started = std::sync::Arc::new(std::sync::Mutex::new(Some(started_tx)));
        let router = Router::new().route(
            "/forever",
            get(move || {
                let started = started.clone();
                async move {
                    if let Some(tx) = started.lock().expect("lock").take() {
                        let _ = tx.send(());
                    }
                    std::future::pending::<()>().await;
                }
            }),
        );
        let token = CancellationToken::new();
        let (addr, server) = serve(router, token.clone(), Duration::from_millis(200)).await;

        let client = reqwest::Client::new();
        let _held = tokio::spawn(client.get(format!("http://{addr}/forever")).send());
        started_rx.await.expect("the request reached the handler");
        token.cancel();

        let drained = tokio::time::timeout(Duration::from_secs(5), server)
            .await
            .expect("the grace ends the drain")
            .expect("join")
            .expect("serve");
        assert_eq!(drained, Drained::DeadlinePassed);
    }
}
