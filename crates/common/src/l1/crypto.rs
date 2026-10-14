//! ´mod:module:crypto´
//!
//! The interim act-authentication realization: Ed25519 signatures, SHA-256
//! salted hash commitments, domain-separated throughout. It is scoped to
//! the stand-in and resolves nothing of open-questions.md Q30.
//!
//! L1 prescribes the properties — authorship, proposal integrity,
//! realization transparency, exact approval, removable-projection binding
//! (layer1-interface.md §8.2) — and leaves the schemes to the deployment.

use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
use sha2::{Digest, Sha256};

pub mod tags {
    //! ´mod:module:tags´
    //!
    //! Domain-separation tags. Every signed or hashed object is prefixed so
    //! no artifact of one role verifies in another.
    //!
    //! A tag's version names its formula: a tag whose formula changes moves
    //! to the next version, so no artifact of the old formula verifies under
    //! the new one. The structures follow the original's handshake
    //! (layer1-interface.md §8.2, "The admission handshake"); the `PN-*`
    //! strings arrive with the real substrate.
    pub const PRE_DIGEST_CONTENT: &[u8] = b"cogra-l1:pre-digest:content:v2";
    pub const PRE_DIGEST_DEPS: &[u8] = b"cogra-l1:pre-digest:deps:v2";
    pub const PRE_COMMITMENT: &[u8] = b"cogra-l1:pre-commitment:v1";
    pub const COMMIT_CONTENT: &[u8] = b"cogra-l1:commitment:content:v2";
    pub const COMMIT_DEPS: &[u8] = b"cogra-l1:commitment:deps:v2";
    pub const HOST_SEAL: &[u8] = b"cogra-l1:host-seal:v2";
    pub const APPROVAL: &[u8] = b"cogra-l1:approval:v2";
}

/// Salt / nonce length: the published entropy floor of the stand-in, which
/// host salts are required to meet (layer1-interface.md §8.2).
pub const SALT_LEN: usize = 32;

pub fn sha256_tagged(tag: &[u8], parts: &[&[u8]]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update((tag.len() as u64).to_be_bytes());
    h.update(tag);
    for p in parts {
        h.update((p.len() as u64).to_be_bytes());
        h.update(p);
    }
    h.finalize().into()
}

/// The actor-side pre-digest of a removable projection: SHA-256 over (tag,
/// act identifier, the actor's private nonce, bytes). It binds the exact
/// bytes to the one act they were proposed for, before any host salt
/// exists (layer1-interface.md §8.2, "Proposal pre-commitment").
pub fn pre_digest(tag: &[u8], act_id: &[u8], nonce: &[u8], bytes: &[u8]) -> [u8; 32] {
    sha256_tagged(tag, &[act_id, nonce, bytes])
}

/// The host-side binding, concealing commitment over a removable
/// projection: SHA-256 over (tag, act identifier, pre-commitment, host
/// salt, bytes). Binding — no second payload is consistent with it;
/// concealing — without salt and bytes the commitment reveals nothing;
/// and it cannot be transplanted to another act or another proposal
/// (layer1-interface.md §8.4; §8.2, "Verified act").
pub fn commitment(
    tag: &[u8],
    act_id: &[u8],
    pre_commitment: &[u8],
    salt: &[u8],
    bytes: &[u8],
) -> [u8; 32] {
    sha256_tagged(tag, &[act_id, pre_commitment, salt, bytes])
}

/// Ed25519 over a digest the caller already formed — the pre-signature
/// over the pre-commitment, and the approval over its tagged digest.
pub fn sign_digest(key: &SigningKey, digest: &[u8; 32]) -> Vec<u8> {
    key.sign(digest).to_bytes().to_vec()
}

/// Ed25519 over the tagged digest of one message.
pub fn sign(key: &SigningKey, tag: &[u8], msg: &[u8]) -> Vec<u8> {
    sign_digest(key, &sha256_tagged(tag, &[msg]))
}

/// Strict Ed25519 verification, which is the seam's acceptance boundary:
/// three languages verify these signatures with three libraries, and only a
/// boundary named in one place keeps a seal the browser accepts from being
/// one the phone refuses.
///
/// Strict is `ed25519_dalek::VerifyingKey::verify_strict`, whose contract
/// adds two refusals to the ordinary check: a small-order public key `A`
/// and a small-order `R` in the signature. The scalar `S` is required to be
/// canonical (`0 ≤ S < ℓ`) by every `verify_*` in that crate, strict or
/// not. The small-order case is not academic — under the identity public
/// key a single signature verifies against every message, and only the
/// strict equation refuses it.
///
/// The refusals are pinned across the clients by the `signatureRefusals`
/// group of `client-crypto-vectors.json`.
pub fn verify(key: &VerifyingKey, tag: &[u8], msg: &[u8], signature: &[u8]) -> bool {
    verify_digest(key, &sha256_tagged(tag, &[msg]), signature)
}

/// Strict verification of a signature made by [`sign_digest`], under the
/// same acceptance boundary as [`verify`].
pub fn verify_digest(key: &VerifyingKey, digest: &[u8; 32], signature: &[u8]) -> bool {
    let Ok(sig) = Signature::from_slice(signature) else {
        return false;
    };
    key.verify_strict(digest, &sig).is_ok()
}

pub fn verifying_key_from_bytes(bytes: &[u8]) -> Option<VerifyingKey> {
    let arr: [u8; 32] = bytes.try_into().ok()?;
    VerifyingKey::from_bytes(&arr).ok()
}

/// Derives the address atom of a public key: hex of the first 20 bytes
/// of SHA-256(pubkey). A stand-in convention — the real address format
/// arrives with the substrate.
pub fn address_of(key: &VerifyingKey) -> String {
    let digest = Sha256::digest(key.as_bytes());
    hex::encode(&digest[..20])
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::rngs::OsRng;

    /// A signature verifies only under the tag and message it was made for:
    /// the same message under another domain tag and a tampered message both
    /// refuse. Garbage signature bytes refuse rather than panic.
    ///
    /// A signature verifies only under the tag and the message it was made for, and garbage refuses rather than panics.
    /// ´claim:crypto:a-signature-verifies-only-under-its-own-tag-and-message´
    #[test]
    fn signatures_verify_and_are_domain_separated() {
        let key = SigningKey::generate(&mut OsRng);
        let msg = b"structural body";
        let sig = sign(&key, tags::PRE_COMMITMENT, msg);
        assert!(verify(
            &key.verifying_key(),
            tags::PRE_COMMITMENT,
            msg,
            &sig
        ));
        assert!(!verify(&key.verifying_key(), tags::APPROVAL, msg, &sig));
        assert!(!verify(
            &key.verifying_key(),
            tags::PRE_COMMITMENT,
            b"structural bodY",
            &sig
        ));
        assert!(!verify(
            &key.verifying_key(),
            tags::PRE_COMMITMENT,
            msg,
            b"xx"
        ));
    }

    /// The seam accepts a signature under strict verification only, so a
    /// small-order public key forges nothing: the same bytes that satisfy the
    /// ordinary group equation against every message are refused here.
    ///
    /// The key is the canonical encoding of the neutral element (y = 1,
    /// sign 0). It has order 1, so `[k]A` is the identity for every
    /// challenge `k` and the group equation collapses to `[S]B = R`; with
    /// `S = 0` and `R` the same identity encoding, one signature satisfies
    /// it for every message.
    ///
    /// Strict verification is the seam's acceptance boundary, so a small-order key forges nothing.
    /// ´claim:crypto:strict-verification-refuses-what-a-small-order-key-forges´
    #[test]
    fn a_small_order_key_forges_nothing_under_strict_verification() {
        use ed25519_dalek::Verifier;

        let mut small_order = [0u8; 32];
        small_order[0] = 1;
        let key =
            verifying_key_from_bytes(&small_order).expect("the identity is a valid point encoding");
        let mut forged = [0u8; 64];
        forged[0] = 1;

        let framed = sha256_tagged(tags::APPROVAL, &[b"one message"]);
        let parsed = Signature::from_slice(&forged).expect("64 bytes");
        assert!(
            key.verify(&framed, &parsed).is_ok(),
            "the ordinary equation accepts the forgery — which is what makes the boundary strict"
        );

        assert!(!verify(&key, tags::APPROVAL, b"one message", &forged));
        assert!(!verify(&key, tags::APPROVAL, b"another message", &forged));
    }

    /// A signature whose scalar S is outside [0, ℓ) is refused, so the
    /// malleability the scalar range forbids never reaches the seam.
    ///
    /// A signature carrying a non-canonical scalar is refused.
    /// ´claim:crypto:a-non-canonical-scalar-is-refused´
    #[test]
    fn a_non_canonical_scalar_is_refused() {
        let key = SigningKey::from_bytes(&[9u8; 32]);
        let msg = b"structural body";
        let mut sig = sign(&key, tags::APPROVAL, msg);
        assert!(verify(&key.verifying_key(), tags::APPROVAL, msg, &sig));
        sig[32..].fill(0xFF);
        assert!(!verify(&key.verifying_key(), tags::APPROVAL, msg, &sig));
    }

    const ACT: &[u8] = b"act:alice:1:publish";
    const PRE: [u8; 32] = [3u8; 32];

    /// A commitment binds its tag, its salt, and its payload, so changing any one of the three changes it.
    /// ´claim:crypto:a-commitment-binds-its-tag-salt-and-payload´
    #[test]
    fn commitments_bind() {
        let salt = [7u8; SALT_LEN];
        let c = commitment(tags::COMMIT_CONTENT, ACT, &PRE, &salt, b"payload");
        assert_eq!(
            c,
            commitment(tags::COMMIT_CONTENT, ACT, &PRE, &salt, b"payload")
        );
        assert_ne!(
            c,
            commitment(tags::COMMIT_CONTENT, ACT, &PRE, &salt, b"payloaX")
        );
        assert_ne!(
            c,
            commitment(
                tags::COMMIT_CONTENT,
                ACT,
                &PRE,
                &[8u8; SALT_LEN],
                b"payload"
            )
        );
        assert_ne!(
            c,
            commitment(tags::COMMIT_DEPS, ACT, &PRE, &salt, b"payload")
        );
    }

    /// The same payload under the same salt commits differently under another act identifier, so a content witness cannot be transplanted to another act.
    /// ´claim:crypto:a-content-commitment-binds-the-act-id-and-the-pre-commitment´
    #[test]
    fn the_same_payload_and_salt_under_another_act_id_commit_differently() {
        let salt = [7u8; SALT_LEN];
        assert_ne!(
            commitment(tags::COMMIT_CONTENT, ACT, &PRE, &salt, b"payload"),
            commitment(
                tags::COMMIT_CONTENT,
                b"act:alice:2:publish",
                &PRE,
                &salt,
                b"payload"
            )
        );
    }

    /// And differently under another pre-commitment, so it binds the one proposal it realizes.
    ///
    /// (´claim:crypto:a-content-commitment-binds-the-act-id-and-the-pre-commitment´)
    #[test]
    fn the_same_payload_and_salt_under_another_pre_commitment_commit_differently() {
        let salt = [7u8; SALT_LEN];
        assert_ne!(
            commitment(tags::COMMIT_CONTENT, ACT, &PRE, &salt, b"payload"),
            commitment(tags::COMMIT_CONTENT, ACT, &[4u8; 32], &salt, b"payload")
        );
    }

    /// The dependency commitment binds the act identifier and the pre-commitment exactly as the content commitment does.
    /// ´claim:crypto:a-dependency-commitment-binds-the-act-id-and-the-pre-commitment´
    #[test]
    fn a_dependency_commitment_binds_the_act_id_and_the_pre_commitment() {
        let salt = [7u8; SALT_LEN];
        let deps = [0x80u8];
        let c = commitment(tags::COMMIT_DEPS, ACT, &PRE, &salt, &deps);
        assert_ne!(
            c,
            commitment(
                tags::COMMIT_DEPS,
                b"act:alice:2:publish",
                &PRE,
                &salt,
                &deps
            )
        );
        assert_ne!(
            c,
            commitment(tags::COMMIT_DEPS, ACT, &[4u8; 32], &salt, &deps)
        );
    }

    /// A pre-digest binds the act identifier it was formed for, so the same bytes under the same nonce digest differently for another act.
    /// ´claim:crypto:a-pre-digest-binds-the-act-id-it-was-formed-for´
    #[test]
    fn a_pre_digest_binds_the_act_id_it_was_formed_for() {
        let nonce = [9u8; SALT_LEN];
        let d = pre_digest(tags::PRE_DIGEST_CONTENT, ACT, &nonce, b"payload");
        assert_eq!(
            d,
            pre_digest(tags::PRE_DIGEST_CONTENT, ACT, &nonce, b"payload")
        );
        assert_ne!(
            d,
            pre_digest(
                tags::PRE_DIGEST_CONTENT,
                b"act:alice:2:publish",
                &nonce,
                b"payload"
            )
        );
        assert_ne!(
            d,
            pre_digest(tags::PRE_DIGEST_DEPS, ACT, &nonce, b"payload")
        );
    }

    /// A commitment formed under the earlier formula — tag, salt, bytes, with no act identifier or pre-commitment — never equals one formed under the current tag and formula.
    /// ´claim:crypto:a-v1-commitment-never-verifies-under-the-v2-formula´
    #[test]
    fn a_v1_commitment_never_verifies_under_the_v2_formula() {
        let salt = [7u8; SALT_LEN];
        let v1 = sha256_tagged(b"cogra-l1:commitment:content:v1", &[&salt, b"payload"]);
        assert_ne!(
            v1,
            commitment(tags::COMMIT_CONTENT, ACT, &PRE, &salt, b"payload")
        );
        assert_ne!(
            v1,
            sha256_tagged(tags::COMMIT_CONTENT, &[&salt, b"payload"]),
            "the version bump alone already separates the two formulas"
        );
    }

    /// Without the length prefixes, two different part lists sharing a
    /// concatenation would hash identically.
    ///
    /// Length framing is what keeps two different part lists from hashing alike.
    /// ´claim:crypto:length-framing-separates-parts-that-would-otherwise-concatenate´
    #[test]
    fn length_framing_prevents_concatenation_ambiguity() {
        assert_ne!(
            sha256_tagged(b"t", &[b"ab", b"c"]),
            sha256_tagged(b"t", &[b"a", b"bc"])
        );
    }

    /// An address derives from a public key at a fixed length, and derives the same one every time.
    /// ´claim:crypto:an-address-derives-stably-from-its-public-key´
    #[test]
    fn address_derivation_is_stable() {
        let key = SigningKey::from_bytes(&[42u8; 32]);
        let addr = address_of(&key.verifying_key());
        assert_eq!(addr.len(), 40);
        assert_eq!(addr, address_of(&key.verifying_key()));
    }
}
