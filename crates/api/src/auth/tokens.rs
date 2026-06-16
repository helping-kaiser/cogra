//! Opaque secrets — refresh tokens and email-verification tokens.
//!
//! Both are cryptographically-random 256-bit values handed to the client in
//! raw form and stored only as their SHA-256 hash, so a database read yields
//! no usable token (auth.md "Refresh token"). The raw value is shown once;
//! the server keeps only the hash and matches by re-hashing on presentation.

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use rand::RngCore;
use sha2::{Digest, Sha256};

/// A freshly minted opaque secret: the `raw` value to hand to the client and
/// the `hash` to persist. The raw value is never stored.
pub struct OpaqueToken {
    pub raw: String,
    pub hash: Vec<u8>,
}

/// Generates a 256-bit random token, URL-safe-base64 encoded, alongside its
/// SHA-256 hash. Used for both refresh tokens and verification tokens.
pub fn generate() -> OpaqueToken {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let raw = URL_SAFE_NO_PAD.encode(bytes);
    let hash = hash(&raw);
    OpaqueToken { raw, hash }
}

/// SHA-256 of a raw token — the stored form, and what lookups re-derive from a
/// presented token.
pub fn hash(raw: &str) -> Vec<u8> {
    Sha256::digest(raw.as_bytes()).to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn raw_rehashes_to_stored_hash() {
        let token = generate();
        assert_eq!(hash(&token.raw), token.hash);
    }

    #[test]
    fn tokens_are_distinct() {
        assert_ne!(generate().raw, generate().raw);
    }
}
