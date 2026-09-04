//! Exports `client-constants.json` (repo root) — the numbers and rules
//! both clients enforce locally, stated once by the side that enforces
//! them for real.
//!
//! The repo already solves this class of problem twice, with
//! `design-tokens.json` and `client-crypto-vectors.json`: an artifact the
//! authoritative side writes and every consumer pins by test. Media caps,
//! attachment counts, the page size, the registration grammar and the
//! write-handshake protocol constants had none of that — each was written
//! out again on each surface, agreeing by memory. The page size was the
//! sharpest case: five copies, one of them inside the guard that prices
//! the client documents against it.
//!
//! The default run asserts the committed file matches this crate, so
//! drift fails `cargo test`; `make constants` (UPDATE_CLIENT_CONSTANTS=1)
//! rewrites it.

use std::path::Path;

use api::auth::{HANDLE_CHARSET_PATTERN, HANDLE_MAX_CHARS, HANDLE_MIN_CHARS, PASSWORD_MIN_CHARS};
use api::media::{
    MAX_ALT_TEXT_CHARS, MAX_COMMENT_ATTACHMENTS, MAX_COMMENT_VIDEO_BYTES, MAX_PIXEL_DIMENSION,
    MAX_POST_ATTACHMENTS, MAX_POST_VIDEO_BYTES, MIN_MULTIPART_PART_BYTES, MediaConfig,
    RESUMABLE_THRESHOLD_BYTES,
};
use api::schema::types::{
    DEFAULT_PAGE_SIZE, ErrorCode, MAX_PAGE_SIZE, SEAL_POLL_ATTEMPTS, SEAL_POLL_INTERVAL_MS,
    TERMINAL_WRITE_REFUSALS,
};
use async_graphql::resolver_utils::EnumType;
use serde_json::{Value, json};

/// The wire spelling of an `ErrorCode`, which is what a client switches
/// on.
///
/// Taken from the derive's own item table rather than re-spelled here:
/// `EnumType::items` is the same table async-graphql renders the SDL
/// from, so the artifact cannot name a code the schema does not.
fn error_code_name(code: ErrorCode) -> &'static str {
    ErrorCode::items()
        .iter()
        .find(|item| item.value == code)
        .map(|item| item.name)
        .expect("every ErrorCode variant is one of its own enum items")
}

fn build_constants() -> Value {
    let media = MediaConfig::default();
    json!({
        "version": 1,
        "media": {
            "stillBytes": media.max_upload_bytes,
            "postVideoBytes": MAX_POST_VIDEO_BYTES,
            "commentVideoBytes": MAX_COMMENT_VIDEO_BYTES,
            "postAttachments": MAX_POST_ATTACHMENTS,
            "commentAttachments": MAX_COMMENT_ATTACHMENTS,
            "altTextChars": MAX_ALT_TEXT_CHARS,
            "maxPixelDimension": MAX_PIXEL_DIMENSION,
            "resumableThresholdBytes": RESUMABLE_THRESHOLD_BYTES,
            "minMultipartPartBytes": MIN_MULTIPART_PART_BYTES,
        },
        "paging": {
            "defaultPageSize": DEFAULT_PAGE_SIZE,
            "maxPageSize": MAX_PAGE_SIZE,
        },
        "registration": {
            "passwordMinChars": PASSWORD_MIN_CHARS,
            "handleMinChars": HANDLE_MIN_CHARS,
            "handleMaxChars": HANDLE_MAX_CHARS,
            "handleCharsetPattern": HANDLE_CHARSET_PATTERN,
        },
        "writeSigner": {
            "terminalRefusals": TERMINAL_WRITE_REFUSALS
                .into_iter()
                .map(error_code_name)
                .collect::<Vec<_>>(),
            "sealPollAttempts": SEAL_POLL_ATTEMPTS,
            "sealPollIntervalMs": SEAL_POLL_INTERVAL_MS,
        },
    })
}

/// The config default and the per-kind constant the resolver checks are
/// one number, or the artifact would export two numbers for one rule.
///
/// The exported media caps are the caps the server itself enforces, not a second statement of them.
/// ´claim:constants:the-exported-caps-are-the-enforced-caps´
#[test]
fn the_exported_caps_are_the_ones_the_server_enforces() {
    let media = MediaConfig::default();
    assert_eq!(
        media.max_video_upload_bytes as i64, MAX_POST_VIDEO_BYTES,
        "the transport default and the post-video cap are one number"
    );
}

/// The two relations between exported caps that hold by construction, so
/// they are checked by construction: a `const` assertion refuses to
/// compile rather than waiting for a test run, and clippy is right that a
/// runtime `assert!` over two constants asserts nothing.
///
/// A comment's video budget is the smaller of the two, and the resumable
/// threshold clears S3's floor under every part but the last — a client
/// switching below that floor would open a session that cannot assemble.
const _: () = assert!(MAX_COMMENT_VIDEO_BYTES < MAX_POST_VIDEO_BYTES);
const _: () = assert!(RESUMABLE_THRESHOLD_BYTES >= MIN_MULTIPART_PART_BYTES);

/// The terminal-refusal list is exported by name, and those names are the
/// SDL's — a variant renamed in Rust changes the string both clients
/// compare against, so the rename has to travel with the artifact.
///
/// Every exported terminal refusal is a code the schema actually publishes.
/// ´claim:constants:every-terminal-refusal-is-a-published-code´
#[test]
fn the_terminal_refusals_are_published_error_codes() {
    let sdl =
        std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("../../schema.graphql"))
            .expect("the exported SDL is committed");
    for code in TERMINAL_WRITE_REFUSALS {
        let name = error_code_name(code);
        assert!(
            sdl.contains(&format!("\n\t{name}\n")),
            "{name} is exported as terminal but the SDL does not publish it"
        );
    }
}

/// The committed client constants match what this crate derives, so drift fails the build rather than reaching a client.
/// ´claim:constants:the-committed-constants-match-what-the-crate-derives´
#[test]
fn exported_constants_match_the_committed_file() {
    let rendered = format!(
        "{}\n",
        serde_json::to_string_pretty(&build_constants()).expect("constants serialize")
    );
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../client-constants.json");
    if std::env::var_os("UPDATE_CLIENT_CONSTANTS").is_some() {
        std::fs::write(&path, rendered).expect("write client-constants.json");
        return;
    }
    let committed = std::fs::read_to_string(&path)
        .expect("client-constants.json is missing — run `make constants`");
    assert_eq!(
        committed, rendered,
        "client-constants.json is stale — run `make constants`"
    );
}
