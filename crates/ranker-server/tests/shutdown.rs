//! The pod's stop: the shutdown token closes the server once its open
//! requests are answered, and the grace bounds a request that never is.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::Router;
use axum::routing::get;
use ranker_server::shutdown::{Drained, serve_until};
use tokio_util::sync::CancellationToken;

/// A route that reports when a request reaches it and then holds the
/// request for `hold`, or forever.
fn holding(hold: Option<Duration>) -> (Router, tokio::sync::oneshot::Receiver<()>) {
    let (reached, reached_rx) = tokio::sync::oneshot::channel::<()>();
    let reached = Arc::new(Mutex::new(Some(reached)));
    let router = Router::new().route(
        "/hold",
        get(move || {
            let reached = reached.clone();
            async move {
                if let Some(tx) = reached.lock().expect("lock").take() {
                    let _ = tx.send(());
                }
                match hold {
                    Some(hold) => tokio::time::sleep(hold).await,
                    None => std::future::pending::<()>().await,
                }
                "held"
            }
        }),
    );
    (router, reached_rx)
}

async fn start(
    router: Router,
    token: CancellationToken,
    grace: Duration,
) -> (
    std::net::SocketAddr,
    tokio::task::JoinHandle<std::io::Result<Drained>>,
) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("a port");
    let address = listener.local_addr().expect("bound");
    (
        address,
        tokio::spawn(serve_until(listener, router, token, grace)),
    )
}

/// A cancelled token stops the pod accepting, the request in flight is
/// still answered, and the server then closes on its own.
///
/// The pod's shutdown answers the request in flight, then closes.
/// ´claim:pod:the-signal-drains-in-flight-requests´
#[tokio::test]
async fn the_signal_drains_in_flight_requests() {
    let (router, reached) = holding(Some(Duration::from_millis(300)));
    let token = CancellationToken::new();
    let (address, server) = start(router, token.clone(), Duration::from_secs(5)).await;

    let in_flight = tokio::spawn(reqwest::get(format!("http://{address}/hold")));
    reached.await.expect("the request reached the pod");
    token.cancel();

    let answer = in_flight.await.expect("join").expect("answered");
    assert_eq!(answer.text().await.expect("a body"), "held");
    let drained = tokio::time::timeout(Duration::from_secs(5), server)
        .await
        .expect("the pod closes after its drain")
        .expect("join")
        .expect("serve");
    assert_eq!(drained, Drained::Clean);
    assert!(
        tokio::net::TcpStream::connect(address).await.is_err(),
        "nothing accepts once the pod has drained"
    );
}

/// A request that never finishes does not hold the pod past its grace.
///
/// The pod lets a request go when the grace after the signal is over.
/// ´claim:pod:the-grace-bounds-the-drain´
#[tokio::test]
async fn the_grace_bounds_the_drain() {
    let (router, reached) = holding(None);
    let token = CancellationToken::new();
    let (address, server) = start(router, token.clone(), Duration::from_millis(200)).await;

    let _held = tokio::spawn(reqwest::get(format!("http://{address}/hold")));
    reached.await.expect("the request reached the pod");
    token.cancel();

    let drained = tokio::time::timeout(Duration::from_secs(5), server)
        .await
        .expect("the grace ends the drain")
        .expect("join")
        .expect("serve");
    assert_eq!(drained, Drained::DeadlinePassed);
}
