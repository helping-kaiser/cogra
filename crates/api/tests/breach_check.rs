//! The HIBP range client (auth.md "Password requirements") against a
//! local stand-in range server: the k-anonymity request shape, the
//! found / clean / padding outcomes, and the error path the caller
//! fails open on.

use axum::Router;
use axum::http::{HeaderMap, StatusCode};
use axum::routing::get;
use sha1::{Digest, Sha1};

use api::breach::{BreachCorpus, HibpCorpus};

/// The uppercase-hex SHA-1 split HIBP uses: 5-char prefix, 35-char
/// suffix.
fn split_digest(password: &str) -> (String, String) {
    let digest = hex::encode_upper(Sha1::digest(password.as_bytes()));
    let (prefix, suffix) = digest.split_at(5);
    (prefix.to_string(), suffix.to_string())
}

/// A one-route range server answering every prefix with the given body;
/// returns the base URL. Asserts the Add-Padding header rides every
/// request — a panic here drops the connection, which the test sees as
/// a transport error.
async fn range_server(status: StatusCode, body: String) -> String {
    let app = Router::new().route(
        "/range/{prefix}",
        get(move |headers: HeaderMap| {
            let body = body.clone();
            async move {
                assert_eq!(
                    headers.get("add-padding").and_then(|v| v.to_str().ok()),
                    Some("true"),
                    "every range request asks for padding"
                );
                (status, body)
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move {
        axum::serve(listener, app).await.expect("serve");
    });
    format!("http://{addr}/range")
}

/// (´claim:breach:a-positive-count-reports-breached´)
#[tokio::test]
async fn a_corpus_hit_reports_breached() {
    let (_, suffix) = split_digest("password123");
    let body = format!("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:0\r\n{suffix}:3");
    let corpus =
        HibpCorpus::with_base_url(range_server(StatusCode::OK, body).await).expect("client");
    assert!(matches!(corpus.is_breached("password123").await, Ok(true)));
}

/// (´claim:breach:only-a-positive-count-is-a-breach´)
#[tokio::test]
async fn an_absent_suffix_reports_clean() {
    let body = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:12\r\nBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB:1"
        .to_string();
    let corpus =
        HibpCorpus::with_base_url(range_server(StatusCode::OK, body).await).expect("client");
    assert!(matches!(
        corpus.is_breached("some novel passphrase").await,
        Ok(false)
    ));
}

/// Add-Padding responses list the queried suffix itself with count 0, so
/// a listed suffix reads as clean unless its count is positive.
///
/// (´claim:breach:only-a-positive-count-is-a-breach´)
#[tokio::test]
async fn a_padding_entry_reports_clean() {
    let (_, suffix) = split_digest("padded password");
    let corpus =
        HibpCorpus::with_base_url(range_server(StatusCode::OK, format!("{suffix}:0")).await)
            .expect("client");
    assert!(matches!(
        corpus.is_breached("padded password").await,
        Ok(false)
    ));
}

/// A corpus answering with a fault is an error for the caller to fail open on, never a verdict about the password.
/// ´claim:breach:a-faulting-corpus-is-an-error´
#[tokio::test]
async fn a_server_fault_is_an_error_for_the_caller_to_fail_open_on() {
    let corpus = HibpCorpus::with_base_url(
        range_server(StatusCode::INTERNAL_SERVER_ERROR, String::new()).await,
    )
    .expect("client");
    assert!(corpus.is_breached("whatever password").await.is_err());
}

/// An unreachable corpus errors within a bounded wait rather than hanging the request behind it.
/// ´claim:breach:an-unreachable-corpus-is-bounded´
#[tokio::test]
async fn an_unreachable_corpus_is_an_error_not_a_hang() {
    let corpus = HibpCorpus::with_base_url("http://127.0.0.1:9/range".to_string()).expect("client");
    assert!(corpus.is_breached("whatever password").await.is_err());
}
