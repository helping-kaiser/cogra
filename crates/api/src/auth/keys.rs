//! Ed25519 signing-key generation — used by the one-shot bootstrap to mint
//! the server's JWT key once, then write it to `.env` as `JWT_SIGNING_KEY`.
//!
//! The key is provisioned out-of-band (env-supplied) rather than ephemeral,
//! so access tokens survive an API restart. The bootstrap is the natural
//! place to generate it: a one-time setup step that runs when the instance is
//! created.

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use ring::rand::SystemRandom;
use ring::signature::Ed25519KeyPair;

/// Generates a fresh Ed25519 keypair and returns its PKCS#8 private key,
/// base64-encoded — the single secret the API needs (it recovers the public
/// verifying key from it). Suitable to write to `.env` as `JWT_SIGNING_KEY`.
pub fn generate_signing_key() -> String {
    let rng = SystemRandom::new();
    // ring's generate_pkcs8 only fails on a broken system RNG; treat that as
    // unrecoverable rather than threading an error through key generation.
    let pkcs8 = Ed25519KeyPair::generate_pkcs8(&rng).expect("system RNG available");
    BASE64.encode(pkcs8.as_ref())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::jwt::JwtKeys;

    #[test]
    fn generated_key_is_usable() {
        // The generated key must load as a working JwtKeys — keygen and the
        // signing path agree on the PKCS#8 encoding.
        let key = generate_signing_key();
        assert!(JwtKeys::from_pkcs8_base64(&key).is_ok());
    }

    #[test]
    fn keys_are_distinct() {
        assert_ne!(generate_signing_key(), generate_signing_key());
    }
}
