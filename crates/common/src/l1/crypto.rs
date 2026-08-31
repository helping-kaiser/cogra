//! ´mod:module:crypto´
//!
//! The interim act-authentication realization: Ed25519 signatures, SHA-256
//! salted hash commitments, domain-separated throughout. It is scoped to
//! the stand-in and resolves nothing of open-questions.md Q30.
//!
//! L1 prescribes the properties — authorship, proposal integrity,
//! realization transparency, exact approval, removable-projection binding
//! (layer1-interface.md §8.2) — and leaves the schemes to the deployment.

use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use sha2::{Digest, Sha256};

pub mod tags {
    //! ´mod:module:tags´
    //!
    //! Domain-separation tags. Every signed or hashed object is prefixed so
    //! no artifact of one role verifies in another.
    pub const PRE_DIGEST_CONTENT: &[u8] = b"cogra-l1:pre-digest:content:v1";
    pub const PRE_DIGEST_DEPS: &[u8] = b"cogra-l1:pre-digest:deps:v1";
    pub const PRE_COMMITMENT: &[u8] = b"cogra-l1:pre-commitment:v1";
    pub const COMMIT_CONTENT: &[u8] = b"cogra-l1:commitment:content:v1";
    pub const COMMIT_DEPS: &[u8] = b"cogra-l1:commitment:deps:v1";
    pub const HOST_SEAL: &[u8] = b"cogra-l1:host-seal:v1";
    pub const APPROVAL: &[u8] = b"cogra-l1:approval:v1";
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

/// The actor-side pre-digest of a removable projection: binds the exact
/// bytes under the actor's private nonce, before any host salt exists
/// (layer1-interface.md §8.2).
pub fn pre_digest(tag: &[u8], nonce: &[u8], bytes: &[u8]) -> [u8; 32] {
    sha256_tagged(tag, &[nonce, bytes])
}

/// The host-side binding, concealing commitment over a removable
/// projection: SHA-256 over (tag, host salt, bytes). Binding — no second
/// payload is consistent with it; concealing — without salt and bytes the
/// commitment reveals nothing (layer1-interface.md §8.4).
pub fn commitment(tag: &[u8], salt: &[u8], bytes: &[u8]) -> [u8; 32] {
    sha256_tagged(tag, &[salt, bytes])
}

pub fn sign(key: &SigningKey, tag: &[u8], msg: &[u8]) -> Vec<u8> {
    let framed = sha256_tagged(tag, &[msg]);
    key.sign(&framed).to_bytes().to_vec()
}

pub fn verify(key: &VerifyingKey, tag: &[u8], msg: &[u8], signature: &[u8]) -> bool {
    let Ok(sig) = Signature::from_slice(signature) else {
        return false;
    };
    let framed = sha256_tagged(tag, &[msg]);
    key.verify(&framed, &sig).is_ok()
}

pub fn verifying_key_from_bytes(bytes: &[u8]) -> Option<VerifyingKey> {
    let arr: [u8; 32] = bytes.try_into().ok()?;
    VerifyingKey::from_bytes(&arr).ok()
}

/// Derives the L0 address atom of a public key: hex of the first 20 bytes
/// of SHA-256(pubkey). A stand-in convention — the real L0 address format
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

    /// A commitment binds its tag, its salt, and its payload, so changing any one of the three changes it.
    /// ´claim:crypto:a-commitment-binds-its-tag-salt-and-payload´
    #[test]
    fn commitments_bind() {
        let salt = [7u8; SALT_LEN];
        let c = commitment(tags::COMMIT_CONTENT, &salt, b"payload");
        assert_eq!(c, commitment(tags::COMMIT_CONTENT, &salt, b"payload"));
        assert_ne!(c, commitment(tags::COMMIT_CONTENT, &salt, b"payloaX"));
        assert_ne!(
            c,
            commitment(tags::COMMIT_CONTENT, &[8u8; SALT_LEN], b"payload")
        );
        assert_ne!(c, commitment(tags::COMMIT_DEPS, &salt, b"payload"));
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
