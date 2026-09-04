//! Exports `client-crypto-vectors.json` (repo root) — the cross-language
//! golden vectors pinning the client-side crypto the Kotlin and TypeScript
//! apps re-implement: the deterministic CBOR subset, the tagged hashing and
//! Ed25519 signing, the admission-handshake messages (l1::client), and the
//! key-backup blob format (auth.md "Blob format (v1)").
//!
//! The default run asserts the committed file matches this crate, so drift
//! fails `cargo test`; `make vectors` (UPDATE_CLIENT_VECTORS=1) rewrites it.
//! Every value is derived from fixed seeds — nothing here is random.

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

fn unhex(s: &str) -> Vec<u8> {
    hex::decode(s).expect("a vector's hex literal decodes")
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

/// Every family's wire name and the act identifier it renders, so all 19
/// are pinned cross-language rather than the five the handshake happens
/// to exercise.
///
/// The wire names are embedded in every act identifier and therefore in
/// every signing base, so a client whose spelling drifts signs a
/// different record than it displays.
fn family_vectors() -> Value {
    json!(
        common::l1::Family::ALL
            .into_iter()
            .map(|family| {
                let id = ActId::new("alice-addr", 1, family).expect("a valid author atom");
                json!({"wireName": family.as_str(), "actId": id.to_string()})
            })
            .collect::<Vec<_>>()
    )
}

/// Inputs every implementation must refuse, and the boundary they name.
///
/// The positive paths were pinned from the first version of this
/// document; the refusals never were, so each language's decoder drew its
/// own acceptance boundary and the three were never compared. A grammar
/// one side accepts and another refuses is a write the browser approves
/// and the phone rejects — a divergence no positive vector can see.
///
/// Every entry is asserted refused by the reference below, so the
/// document cannot claim a refusal the reference does not reach.
fn rejection_vectors() -> Value {
    let wire_cases: [(&str, Vec<u8>); 6] = [
        ("an empty wire frame", vec![]),
        ("a proposal frame that is not an array", vec![0x01]),
        ("a proposal frame of the wrong arity", {
            let mut e = Encoder::new();
            e.array(2).uint(1).uint(1);
            e.finish()
        }),
        (
            "a proposal frame truncated inside its head",
            vec![0x9b, 0xff, 0xff],
        ),
        ("a proposal frame with trailing bytes", {
            let mut framed = wire::encode_proposal(&Proposal {
                body: StructuralBody {
                    author: "alice-addr".into(),
                    seq: 1,
                    family: common::l1::Family::Opinion,
                    middle: None,
                    target: NodeId::parse("prof:bob").expect("valid node id"),
                    p_d: 1.0,
                    p_i: -0.25,
                    settlement_ref: None,
                    license: None,
                    asserted_parents: vec![],
                },
                payload: b"hello, cogra".to_vec(),
                deps: vec![],
            });
            framed.push(0x00);
            framed
        }),
        ("a non-minimal CBOR head", vec![0x98, 0x02, 0x01, 0x01]),
    ];

    let identifier_cases: [(&str, &str); 5] = [
        ("an act id with too few parts", "act:alice:1"),
        ("an act id with an unknown family", "act:alice:1:nonsense"),
        ("an act id with a signed sequence", "act:alice:+1:opinion"),
        (
            "an act id with a non-numeric sequence",
            "act:alice:x:opinion",
        ),
        (
            "an act id whose sequence overflows u64",
            "act:alice:18446744073709551616:opinion",
        ),
    ];

    let mut out = Vec::new();
    for (case, bytes) in wire_cases {
        assert!(
            wire::decode_proposal(&bytes).is_err(),
            "{case}: the reference refuses this frame"
        );
        out.push(json!({"case": case, "what": "decodeProposal", "hex": hx(&bytes)}));
    }
    for (case, text) in identifier_cases {
        assert!(
            ActId::parse(text).is_err(),
            "{case}: the reference refuses this identifier"
        );
        out.push(json!({"case": case, "what": "parseActId", "text": text}));
    }
    json!(out)
}

/// One structural body, as the document states it.
///
/// `seq` travels as a STRING, not a number. It is `u64` on every side,
/// and a JSON number above 2^53 loses precision in a JavaScript reader
/// before any assertion runs — a large-sequence vector would then produce
/// a different act id than the reference encoded, and read as a
/// misleading diff or a false pass.
fn body_json(b: &StructuralBody) -> Value {
    json!({
        "author": b.author,
        "seq": b.seq.to_string(),
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

/// The signature-refusal corpus: the acceptance boundary the seam requires,
/// stated as inputs every implementation must refuse.
///
/// Three languages verify these signatures with three libraries, and the
/// load-bearing direction is the host seal — a client deciding whether to
/// approve what the backend sealed. A boundary difference would surface as
/// "the phone refuses a write the browser approved", never as a failing
/// test, so the reference's verdict is exported and pinned instead.
///
/// Each entry is refused by `crypto::verify` here, asserted below. `refusal`
/// names why, so an implementation that accepts one knows which check it is
/// missing rather than only that it disagreed.
///
/// EVERY small-order public key is exported, not one sample of them. A
/// client that cannot compute the order of a point — the browser, which
/// has no curve primitive for it — refuses this class from a table, and a
/// table checked against one member is a table that passes while missing
/// the other seven. The whole class travels so the pin is the class.
///
/// The neutral element is the readable case: order 1, so the group
/// equation collapses to `[S]B = R` and the pair `(R, S) = (identity, 0)`
/// satisfies it for every message. Only strict verification — which
/// refuses a small-order `A` — rejects it. The non-canonical `S` is the
/// scalar-range check every conforming verifier owes, whatever else it
/// does.
const SMALL_ORDER_KEYS: [&str; 8] = [
    "0100000000000000000000000000000000000000000000000000000000000000",
    "0000000000000000000000000000000000000000000000000000000000000000",
    "0000000000000000000000000000000000000000000000000000000000000080",
    "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
    "26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05",
    "26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85",
    "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a",
    "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa",
];

fn signature_refusals(actor_signing: &SigningKey, sample: &[u8]) -> Value {
    let actor_pubkey = hx(actor_signing.verifying_key().as_bytes());
    let tag = String::from_utf8(tags::APPROVAL.to_vec()).expect("ASCII");

    let mut small_order_sig = [0u8; 64];
    small_order_sig[0] = 1;

    let mut non_canonical_s = sample.to_vec();
    non_canonical_s[32..].fill(0xFF);

    let mut long = sample.to_vec();
    long.push(0);

    let mut cases = vec![json!({
        "case": "non-canonical scalar S",
        "refusal": "S is not in [0, ℓ)",
        "publicKeyHex": actor_pubkey,
        "tagUtf8": tag,
        "msgUtf8": "cogra",
        "signatureHex": hx(&non_canonical_s),
    })];

    for key_hex in SMALL_ORDER_KEYS {
        let bytes = unhex(key_hex);
        cases.push(json!({
            "case": format!("small-order public key {key_hex}"),
            "refusal": "A is a small-order point; the signature verifies under the ordinary equation for every message",
            "publicKeyHex": key_hex,
            "tagUtf8": tag,
            "msgUtf8": "cogra",
            "signatureHex": hx(&small_order_sig),
        }));
        let key = crypto::verifying_key_from_bytes(&bytes)
            .unwrap_or_else(|| panic!("{key_hex}: a small-order encoding still parses as a key"));
        assert!(
            !crypto::verify(&key, tags::APPROVAL, b"cogra", &small_order_sig),
            "the small-order key {key_hex} is refused by the reference"
        );
    }

    for (case, signature) in [
        ("63-byte signature", &sample[..63]),
        ("65-byte signature", long.as_slice()),
    ] {
        cases.push(json!({
            "case": case,
            "refusal": "a signature is exactly 64 bytes",
            "publicKeyHex": actor_pubkey,
            "tagUtf8": tag,
            "msgUtf8": "cogra",
            "signatureHex": hx(signature),
        }));
    }

    for (case, signature) in [
        ("non-canonical scalar S", non_canonical_s.as_slice()),
        ("63-byte signature", &sample[..63]),
        ("65-byte signature", long.as_slice()),
    ] {
        let key = crypto::verifying_key_from_bytes(actor_signing.verifying_key().as_bytes())
            .unwrap_or_else(|| panic!("{case}: the key parses, so the refusal is the signature's"));
        assert!(
            !crypto::verify(&key, tags::APPROVAL, b"cogra", signature),
            "{case} is refused by the reference"
        );
    }

    Value::Array(cases)
}

/// The typed-input corpus for the recovery code: what a person may hand
/// the parser, and what the reference makes of it.
///
/// The display direction was already pinned; the reading direction was
/// each client's own guess, and the guesses differed exactly where no two
/// languages agree — the separator class. `expect` is `bytes` for an
/// input that parses (the code's own 16 bytes) and otherwise names the
/// refusal, so a client that accepts a code the reference refuses fails
/// here rather than opening a blob nobody else can.
///
/// Every entry is asserted against the reference below, so the document
/// cannot record a verdict the reference does not actually reach.
///
/// The unit-separator case puts U+001C IN PLACE OF a code character
/// rather than between two: a parser that wrongly strips it would then
/// refuse for length instead, and the two verdicts have to stay
/// distinguishable for the case to catch anything.
fn recovery_code_inputs(code: &RecoveryCode) -> Value {
    let display = code.display();
    let squashed = display.replace('-', "");
    let accepted: [(&str, String); 10] = [
        ("the display form", display.clone()),
        ("lower case", display.to_lowercase()),
        ("no grouping", squashed.clone()),
        ("spaces for hyphens", display.replace('-', " ")),
        ("a non-breaking space", display.replace('-', "\u{a0}")),
        ("an em space", display.replace('-', "\u{2003}")),
        ("a next-line separator", display.replace('-', "\u{85}")),
        ("tabs and newlines", display.replace('-', "\t\n")),
        ("a pasted byte-order mark", format!("\u{feff}{display}")),
        ("leading and trailing space", format!("  {display}\u{a0}\n")),
    ];
    let refused: [(&str, String, &str); 5] = [
        ("empty", String::new(), "length"),
        (
            "one character short",
            squashed[..squashed.len() - 1].to_string(),
            "length",
        ),
        ("one character long", format!("{squashed}0"), "length"),
        (
            "a unit separator, which Unicode does not call white space",
            format!("{}\u{1c}", &squashed[..squashed.len() - 1]),
            "character",
        ),
        (
            "trailing pad bits set",
            format!("{}1", &squashed[..squashed.len() - 1]),
            "padBits",
        ),
    ];

    let mut out = Vec::new();
    for (case, input) in accepted {
        let parsed = RecoveryCode::from_input(&input)
            .unwrap_or_else(|e| panic!("{case}: the reference accepts this input ({e})"));
        assert_eq!(parsed.bytes(), code.bytes(), "{case}");
        out.push(json!({
            "case": case,
            "input": input,
            "expect": "bytes",
            "bytesHex": hx(code.bytes()),
        }));
    }
    for (case, input, refusal) in refused {
        let error = RecoveryCode::from_input(&input)
            .err()
            .unwrap_or_else(|| panic!("{case}: the reference refuses this input"));
        let named = match error {
            key_backup::RecoveryCodeError::Length => "length",
            key_backup::RecoveryCodeError::Character(_) => "character",
            key_backup::RecoveryCodeError::PadBits => "padBits",
        };
        assert_eq!(named, refusal, "{case}");
        out.push(json!({"case": case, "input": input, "expect": refusal}));
    }
    json!(out)
}

/// Builds the whole vector document.
///
/// The handshake section runs exactly as l1::client performs it, under a
/// fixed nonce and fixed host salts, so every intermediate value is pinned —
/// and the real client approval path is then made to accept the fixture it
/// pins. The key-backup section seals through the shipping module under a
/// fixed code, salt and nonce, with the real open path accepting that
/// fixture in turn. The upload proof (auth.md "Key recovery") has the actor
/// key sign the server's challenge bound to those exact blob bytes.
///
/// `version` is 2 since the refusal corpus arrived: `signatureRefusals`,
/// `rejections`, `families` and `keyBackup.recoveryCodeInputs` are groups a
/// version-1 reader does not know to look for. The number moves only once
/// every client reads the new shape, which is what each client's own version
/// assertion states.
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
        "version": 2,
        "encoding": encoding_vectors(),
        "families": family_vectors(),
        "rejections": rejection_vectors(),
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
        "signatureRefusals": signature_refusals(&actor_signing, &sign_sample),
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
            "recoveryCodeInputs": recovery_code_inputs(&code),
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

/// The committed cross-language vectors match what this crate derives, so drift fails the build rather than reaching another language.
/// ´claim:vectors:the-committed-vectors-match-what-the-crate-derives´
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
