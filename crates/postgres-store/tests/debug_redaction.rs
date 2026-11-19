//! The store types that hold a nonce or a payload print lengths, never
//! bytes, so a log line of one carries neither.

use postgres_store::content::ActPayload;
use postgres_store::genesis::HandshakeNonces;
use postgres_store::staged::{PreSignedParts, StagedCopy};

const PAYLOAD: &[u8] = b"hello";

/// No byte of either fixed run, nor the payload, appears in `shown`.
fn assert_redacted(shown: &str) {
    assert!(!shown.contains("199, 199"), "{shown}");
    assert!(!shown.contains("106, 106"), "{shown}");
    assert!(!shown.contains("104, 101, 108, 108, 111"), "{shown}");
}

/// The carriage and staged-copy rows show the payload's and the content nonce's lengths, never their bytes.
/// ´claim:redaction:a-stored-payload-prints-only-its-length´
#[test]
fn a_stored_payload_prints_only_its_length() {
    let carriage = ActPayload {
        payload: Some(PAYLOAD.to_vec()),
        content_nonce: Some(vec![0xc7; 32]),
        content_salt: None,
        reduced: false,
        reduced_at: None,
    };
    let shown = format!("{carriage:?}");
    assert_redacted(&shown);
    assert!(shown.contains("<5 bytes>") && shown.contains("<32 bytes>"));

    let staged = StagedCopy {
        id: uuid::Uuid::nil(),
        state: "pre_signed".into(),
        carried: false,
        payload: Some(PAYLOAD.to_vec()),
        content_nonce: Some(vec![0xc7; 32]),
        content_salt: None,
        content_commitment: None,
    };
    let shown = format!("{staged:?}");
    assert_redacted(&shown);
    assert!(shown.contains("<5 bytes>") && shown.contains("<32 bytes>"));
}

/// The pre-signed leg and the genesis custody nonces show each nonce's length, never its bytes.
/// ´claim:redaction:a-stored-nonce-prints-only-its-length´
#[test]
fn a_stored_nonce_prints_only_its_length() {
    let leg = PreSignedParts {
        author_pubkey: vec![1; 32],
        content_nonce: vec![0xc7; 32],
        dependency_nonce: vec![0x6a; 32],
        pre_signature: vec![3; 64],
    };
    let shown = format!("{leg:?}");
    assert_redacted(&shown);
    assert_eq!(shown.matches("<32 bytes>").count(), 2, "{shown}");

    let custody = HandshakeNonces {
        content_nonce: Some(vec![0xc7; 32]),
        dependency_nonce: vec![0x6a; 32],
    };
    let shown = format!("{custody:?}");
    assert_redacted(&shown);
    assert_eq!(shown.matches("<32 bytes>").count(), 2, "{shown}");
}
