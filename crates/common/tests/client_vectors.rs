// Exports `client-crypto-vectors.json` (repo root) — the cross-language
// golden vectors pinning the client-side crypto the Kotlin and TypeScript
// apps re-implement: the deterministic CBOR subset, the tagged hashing and
// Ed25519 signing, the admission-handshake messages (l1::client), and the
// key-backup blob format (auth.md "Blob format (v1)").
//
// The default run asserts the committed file matches this crate, so drift
// fails `cargo test`; `make vectors` (UPDATE_CLIENT_VECTORS=1) rewrites it.
// Every value is derived from fixed seeds — nothing here is random.

use std::path::Path;

use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use common::l1::crypto::{self, tags};
use common::l1::encoding::Encoder;
use common::l1::handshake::{canonical_deps, pre_commitment_msg};
use common::l1::key_backup::{self, RecoveryCode};
use common::l1::{
    ActId, ActorKey, NodeId, PreSignedProposal, Proposal, StructuralBody, VerifiedAct, wire,
};
use ed25519_dalek::SigningKey;
use serde_json::{Value, json};

fn seq_bytes(start: u8, len: usize) -> Vec<u8> {
    (0..len).map(|i| start.wrapping_add(i as u8)).collect()
}

fn hx(b: &[u8]) -> String {
    hex::encode(b)
}

fn cbor(build: impl FnOnce(&mut Encoder)) -> String {
    let mut e = Encoder::new();
    build(&mut e);
    hx(&e.finish())
}

fn tagged(tag: &[u8], parts: &[&[u8]]) -> Value {
    json!({
        "tagUtf8": String::from_utf8(tag.to_vec()).expect("tags are ASCII"),
        "partsHex": parts.iter().map(|p| hx(p)).collect::<Vec<_>>(),
        "digestHex": hx(&crypto::sha256_tagged(tag, parts)),
    })
}

fn body_json(b: &StructuralBody) -> Value {
    json!({
        "author": b.author,
        "seq": b.seq,
        "family": b.family.as_str(),
        "middle": b.middle.as_ref().map(|m| m.to_string()),
        "target": b.target.to_string(),
        "pD": b.p_d,
        "pI": b.p_i,
        "settlementRef": b.settlement_ref.as_ref().map(|r| r.to_string()),
        "license": b.license,
        "assertedParents": b.asserted_parents.iter().map(|p| p.to_string()).collect::<Vec<_>>(),
        "actId": b.act_id().to_string(),
        "canonicalBytesHex": hx(&b.canonical_bytes()),
    })
}

fn encoding_vectors() -> Value {
    json!([
        {"value": "uint 0", "cborHex": cbor(|e| { e.uint(0); })},
        {"value": "uint 23", "cborHex": cbor(|e| { e.uint(23); })},
        {"value": "uint 24", "cborHex": cbor(|e| { e.uint(24); })},
        {"value": "uint 255", "cborHex": cbor(|e| { e.uint(255); })},
        {"value": "uint 256", "cborHex": cbor(|e| { e.uint(256); })},
        {"value": "uint 65535", "cborHex": cbor(|e| { e.uint(65535); })},
        {"value": "uint 65536", "cborHex": cbor(|e| { e.uint(65536); })},
        {"value": "uint 4294967295", "cborHex": cbor(|e| { e.uint(4_294_967_295); })},
        {"value": "uint 4294967296", "cborHex": cbor(|e| { e.uint(4_294_967_296); })},
        {"value": "bytes ''", "cborHex": cbor(|e| { e.bytes(b""); })},
        {"value": "bytes 0102", "cborHex": cbor(|e| { e.bytes(&[1, 2]); })},
        {"value": "text ''", "cborHex": cbor(|e| { e.text(""); })},
        {"value": "text 'cogra'", "cborHex": cbor(|e| { e.text("cogra"); })},
        {"value": "text 'héllo → ✓'", "cborHex": cbor(|e| { e.text("héllo → ✓"); })},
        {"value": "float 0.0", "cborHex": cbor(|e| { e.float(0.0); })},
        {"value": "float 1.0", "cborHex": cbor(|e| { e.float(1.0); })},
        {"value": "float -1.0", "cborHex": cbor(|e| { e.float(-1.0); })},
        {"value": "float 0.5", "cborHex": cbor(|e| { e.float(0.5); })},
        {"value": "float -0.25", "cborHex": cbor(|e| { e.float(-0.25); })},
        {"value": "null", "cborHex": cbor(|e| { e.null(); })},
        {"value": "array(0)", "cborHex": cbor(|e| { e.array(0); })},
        {"value": "array(2)[uint 1, array(1)[text 'x']]", "cborHex": cbor(|e| {
            e.array(2);
            e.uint(1);
            e.array(1);
            e.text("x");
        })},
    ])
}

fn build_vectors() -> Value {
    let actor_seed: [u8; 32] = seq_bytes(0x01, 32).try_into().expect("32 bytes");
    let actor = ActorKey::from_seed(actor_seed);
    let actor_signing = SigningKey::from_bytes(&actor_seed);
    let host_seed: [u8; 32] = seq_bytes(0x41, 32).try_into().expect("32 bytes");
    let host = SigningKey::from_bytes(&host_seed);

    let sign_msg = b"cogra".to_vec();
    let sign_sample = crypto::sign(&actor_signing, tags::APPROVAL, &sign_msg);
    assert!(
        crypto::verify(
            &actor_signing.verifying_key(),
            tags::APPROVAL,
            &sign_msg,
            &sign_sample,
        ),
        "sign sample verifies"
    );

    let body = StructuralBody {
        author: actor.address(),
        seq: 1,
        family: common::l1::Family::Opinion,
        middle: None,
        target: NodeId::parse("prof:bob").expect("valid node id"),
        p_d: 1.0,
        p_i: -0.25,
        settlement_ref: None,
        license: None,
        asserted_parents: vec![],
    };
    let body_full = StructuralBody {
        author: "alice-addr".into(),
        seq: 7,
        family: common::l1::Family::Review,
        middle: Some(NodeId::parse("mint:act:alice-addr:3:publish").expect("valid node id")),
        target: NodeId::parse("name:general").expect("valid node id"),
        p_d: 0.5,
        p_i: -1.0,
        settlement_ref: Some(ActId::parse("act:alice-addr:5:send").expect("valid act id")),
        license: Some("CC-BY-4.0".into()),
        asserted_parents: vec![
            ActId::parse("act:alice-addr:6:opinion").expect("valid act id"),
            ActId::parse("act:bob:2:opinion").expect("valid act id"),
        ],
    };

    // The full handshake, exactly as l1::client performs it, under a fixed
    // nonce and fixed host salts so every intermediate value is pinned.
    let proposal = Proposal {
        body: body.clone(),
        payload: b"hello, cogra".to_vec(),
        deps: vec![ActId::parse("act:bob:1:registration").expect("valid act id")],
    };
    let nonce = seq_bytes(0xA1, crypto::SALT_LEN);
    let digest_content = crypto::pre_digest(tags::PRE_DIGEST_CONTENT, &nonce, &proposal.payload);
    let deps_bytes = canonical_deps(&proposal.deps);
    let digest_deps = crypto::pre_digest(tags::PRE_DIGEST_DEPS, &nonce, &deps_bytes);
    let msg = pre_commitment_msg(&proposal.body, &digest_content, &digest_deps);
    let pre_signature = crypto::sign(&actor_signing, tags::PRE_COMMITMENT, &msg);
    let pre = PreSignedProposal {
        proposal: proposal.clone(),
        author_pubkey: actor.public_key_bytes(),
        nonce: nonce.clone(),
        pre_signature: pre_signature.clone(),
    };

    let content_salt = seq_bytes(0xC1, crypto::SALT_LEN);
    let deps_salt = seq_bytes(0xE1, crypto::SALT_LEN);
    let mut sealed = VerifiedAct {
        proposal: proposal.clone(),
        author_pubkey: pre.author_pubkey.clone(),
        nonce: nonce.clone(),
        pre_signature: pre_signature.clone(),
        content_commitment: crypto::commitment(
            tags::COMMIT_CONTENT,
            &content_salt,
            &proposal.payload,
        )
        .to_vec(),
        deps_commitment: crypto::commitment(tags::COMMIT_DEPS, &deps_salt, &deps_bytes).to_vec(),
        content_salt,
        deps_salt,
        host_seal: vec![],
    };
    sealed.host_seal = crypto::sign(&host, tags::HOST_SEAL, &sealed.seal_msg());

    // The real client path must accept the fixture it pins.
    let witness = actor
        .approve(&pre, &sealed, host.verifying_key().as_bytes())
        .expect("the client approval path accepts the sealed act");

    let wire_proposal = wire::encode_proposal(&proposal);
    let wire_pre_commitment = wire::encode_pre_commitment(&nonce, &pre_signature);
    let wire_verified_act = wire::encode_verified_act(&sealed);
    assert_eq!(
        wire::decode_proposal(&wire_proposal).expect("round-trips"),
        proposal
    );
    assert_eq!(
        wire::decode_pre_commitment(&wire_pre_commitment).expect("round-trips"),
        (nonce.clone(), pre_signature.clone())
    );
    assert_eq!(
        wire::decode_verified_act(&wire_verified_act).expect("round-trips"),
        sealed
    );

    // The key-backup blob (auth.md "Blob format (v1)") via the shipping
    // module, under a fixed code, salt, and nonce; the real open path
    // must accept the fixture it pins.
    let code_bytes: [u8; 16] = seq_bytes(0x00, 16).try_into().expect("16 bytes");
    let hkdf_salt: [u8; 16] = seq_bytes(0x51, 16).try_into().expect("16 bytes");
    let aes_nonce: [u8; 12] = seq_bytes(0x61, 12).try_into().expect("12 bytes");
    let code = RecoveryCode::from_bytes(code_bytes);
    let blob = key_backup::seal_with(&actor_seed, &code, &hkdf_salt, &aes_nonce);
    assert_eq!(
        key_backup::open(&blob, &code).expect("the blob opens under the same code"),
        actor_seed
    );
    let mut content_key = [0u8; 32];
    hkdf::Hkdf::<sha2::Sha256>::new(Some(&hkdf_salt), &code_bytes)
        .expand(key_backup::HKDF_INFO, &mut content_key)
        .expect("32 bytes is a valid HKDF-SHA-256 output length");
    let plaintext = {
        let mut e = Encoder::new();
        e.array(2);
        e.bytes(&actor_seed);
        e.uint(1);
        e.finish()
    };

    // The upload proof (auth.md "Key recovery"): the actor key signs the
    // server's challenge bound to these exact blob bytes.
    let upload_challenge: [u8; key_backup::CHALLENGE_LEN] =
        seq_bytes(0x71, key_backup::CHALLENGE_LEN)
            .try_into()
            .expect("challenge bytes");
    let actor_signing = SigningKey::from_bytes(&actor_seed);
    let upload_signature = key_backup::sign_upload(&actor_signing, &upload_challenge, &blob);
    assert!(key_backup::verify_upload(
        &actor_signing.verifying_key(),
        &upload_challenge,
        &blob,
        &upload_signature
    ));

    json!({
        "version": 1,
        "encoding": encoding_vectors(),
        "sha256Tagged": [
            tagged(tags::PRE_COMMITMENT, &[]),
            tagged(tags::COMMIT_CONTENT, &[b"", &[1, 2]]),
            tagged(tags::APPROVAL, &[b"seal"]),
        ],
        "signing": {
            "seedHex": hx(&actor_seed),
            "publicKeyHex": hx(&actor.public_key_bytes()),
            "l0Address": actor.address(),
            "samples": [{
                "tagUtf8": String::from_utf8(tags::APPROVAL.to_vec()).expect("ASCII"),
                "msgUtf8": "cogra",
                "signatureHex": hx(&sign_sample),
            }],
        },
        "structuralBodies": [body_json(&body), body_json(&body_full)],
        "handshake": {
            "host": {"seedHex": hx(&host_seed), "publicKeyHex": hx(host.verifying_key().as_bytes())},
            "proposal": {
                "body": body_json(&proposal.body),
                "payloadHex": hx(&proposal.payload),
                "deps": proposal.deps.iter().map(|d| d.to_string()).collect::<Vec<_>>(),
            },
            "canonicalDepsHex": hx(&deps_bytes),
            "wireProposalHex": hx(&wire_proposal),
            "nonceHex": hx(&nonce),
            "contentPreDigestHex": hx(&digest_content),
            "depsPreDigestHex": hx(&digest_deps),
            "preCommitmentMsgHex": hx(&msg),
            "preSignatureHex": hx(&pre_signature),
            "wirePreCommitmentHex": hx(&wire_pre_commitment),
            "contentSaltHex": hx(&sealed.content_salt),
            "depsSaltHex": hx(&sealed.deps_salt),
            "contentCommitmentHex": hx(&sealed.content_commitment),
            "depsCommitmentHex": hx(&sealed.deps_commitment),
            "sealMsgHex": hx(&sealed.seal_msg()),
            "hostSealHex": hx(&sealed.host_seal),
            "wireVerifiedActHex": hx(&wire_verified_act),
            "approvalActId": witness.act_id.to_string(),
            "approvalSignatureHex": hx(&witness.approval_signature),
        },
        "keyBackup": {
            "recoveryCodeBytesHex": hx(&code_bytes),
            "recoveryCodeDisplay": code.display(),
            "hkdfInfoUtf8": "cogra:key-backup:v1",
            "hkdfSaltHex": hx(&hkdf_salt),
            "contentKeyHex": hx(&content_key),
            "aesNonceHex": hx(&aes_nonce),
            "plaintextHex": hx(&plaintext),
            "blobHex": hx(&blob),
            "blobBase64": B64.encode(&blob),
            "uploadProofTagUtf8": "cogra:key-backup-upload:v1",
            "uploadChallengeHex": hx(&upload_challenge),
            "uploadSignatureHex": hx(&upload_signature),
        },
    })
}

#[test]
fn exported_vectors_match_the_committed_file() {
    let rendered = format!(
        "{}\n",
        serde_json::to_string_pretty(&build_vectors()).expect("vectors serialize")
    );
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../client-crypto-vectors.json");
    if std::env::var_os("UPDATE_CLIENT_VECTORS").is_some() {
        std::fs::write(&path, rendered).expect("write client-crypto-vectors.json");
        return;
    }
    let committed = std::fs::read_to_string(&path)
        .expect("client-crypto-vectors.json is missing — run `make vectors`");
    assert_eq!(
        committed, rendered,
        "client-crypto-vectors.json is stale — run `make vectors`"
    );
}
