//! Access tokens — stateless Ed25519-signed JWTs (auth.md "Access token").
//!
//! Claims are `sub` (User UUID), `iat`, `exp`, and `jti` binding the token to
//! its issuing refresh-token session. No role claim — `network_role` is read
//! live from the graph at the action site, never trusted from the token.
//! Lifetime is 15 minutes; revocation is achieved through that short lifetime
//! plus refresh-token revocation, not in-band.

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use chrono::Utc;
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation};
use ring::signature::{Ed25519KeyPair, KeyPair};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Access-token lifetime (auth.md default).
pub const ACCESS_TOKEN_TTL_MINUTES: i64 = 15;

#[derive(Debug, thiserror::Error)]
pub enum JwtError {
    #[error("the signing key is not valid base64 / PKCS#8")]
    BadKey,
    #[error("minting the access token failed")]
    Mint,
}

/// JWT claims. `sub` and `jti` are UUID strings; `iat` / `exp` are Unix
/// seconds.
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub jti: String,
    pub iat: i64,
    pub exp: i64,
}

/// The server's Ed25519 keypair, derived from a single stored secret: the
/// PKCS#8 private key. The public verifying key is recovered from it, so only
/// one env var (`JWT_SIGNING_KEY`) carries the secret.
pub struct JwtKeys {
    encoding: EncodingKey,
    decoding: DecodingKey,
}

impl JwtKeys {
    /// Builds the keypair from a base64-encoded PKCS#8 Ed25519 private key
    /// (as produced by [`super::keys::generate_signing_key`]).
    pub fn from_pkcs8_base64(pkcs8_b64: &str) -> Result<Self, JwtError> {
        let pkcs8 = BASE64.decode(pkcs8_b64).map_err(|_| JwtError::BadKey)?;
        let key_pair = Ed25519KeyPair::from_pkcs8(&pkcs8).map_err(|_| JwtError::BadKey)?;
        let public = key_pair.public_key().as_ref();
        Ok(JwtKeys {
            encoding: EncodingKey::from_ed_der(&pkcs8),
            decoding: DecodingKey::from_ed_der(public),
        })
    }

    /// Mints an access token for `user` bound to refresh-session `jti`.
    pub fn mint_access(&self, user: Uuid, jti: Uuid) -> Result<String, JwtError> {
        let now = Utc::now();
        let claims = Claims {
            sub: user.to_string(),
            jti: jti.to_string(),
            iat: now.timestamp(),
            exp: (now + chrono::Duration::minutes(ACCESS_TOKEN_TTL_MINUTES)).timestamp(),
        };
        jsonwebtoken::encode(&Header::new(Algorithm::EdDSA), &claims, &self.encoding)
            .map_err(|_| JwtError::Mint)
    }

    /// Verifies an access token and returns its claims. `None` on any failure
    /// — bad signature, expiry, or malformed token — so an invalid token reads
    /// exactly like an anonymous request.
    pub fn verify_access(&self, token: &str) -> Option<Claims> {
        let validation = Validation::new(Algorithm::EdDSA);
        jsonwebtoken::decode::<Claims>(token, &self.decoding, &validation)
            .ok()
            .map(|data| data.claims)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::keys::generate_signing_key;

    fn keys() -> JwtKeys {
        JwtKeys::from_pkcs8_base64(&generate_signing_key()).expect("valid generated key")
    }

    #[test]
    fn mint_then_verify_roundtrips() {
        let keys = keys();
        let user = Uuid::new_v4();
        let jti = Uuid::new_v4();
        let token = keys.mint_access(user, jti).expect("mints");
        let claims = keys.verify_access(&token).expect("verifies");
        assert_eq!(claims.sub, user.to_string());
        assert_eq!(claims.jti, jti.to_string());
    }

    #[test]
    fn a_different_key_rejects_the_token() {
        let token = keys()
            .mint_access(Uuid::new_v4(), Uuid::new_v4())
            .expect("mints");
        assert!(keys().verify_access(&token).is_none());
    }

    #[test]
    fn garbage_is_rejected() {
        assert!(keys().verify_access("not.a.jwt").is_none());
    }
}
