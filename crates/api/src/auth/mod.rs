//! Server-side authentication (auth.md): Argon2id passwords, Ed25519 JWT
//! access tokens, SHA-256-hashed rotating refresh tokens, and the per-request
//! viewer resolved from the `Authorization` header.

pub mod jwt;
pub mod keys;
pub mod password;
pub mod policy;
pub mod tokens;
pub mod validate;

use uuid::Uuid;

use crate::auth::jwt::JwtKeys;

/// The resolved request viewer, injected into the GraphQL execution context.
/// `Some` when a valid Bearer access token was presented, `None` otherwise.
/// Reads are anonymous-safe (api-spec.md "Viewer context rides the request");
/// the viewer's only jobs are field-level authorization and `me` resolution.
#[derive(Clone, Copy, Debug)]
pub struct Viewer(pub Option<Uuid>);

impl Viewer {
    /// Resolves the viewer from an `Authorization: Bearer <jwt>` header value.
    /// Any failure — missing header, wrong scheme, bad signature, expiry —
    /// yields an anonymous viewer, never an error: an invalid token reads
    /// exactly like no token.
    pub fn from_bearer(header: Option<&str>, keys: &JwtKeys) -> Viewer {
        let id = header
            .and_then(|h| h.strip_prefix("Bearer "))
            .and_then(|token| keys.verify_access(token.trim()))
            .and_then(|claims| Uuid::parse_str(&claims.sub).ok());
        Viewer(id)
    }

    /// The authenticated user id, or an `UNAUTHENTICATED` transport fault for
    /// the mutations that require a session. The code rides `extensions.code`
    /// (tier 1, not a `userError`) so the client's refresh-and-replay
    /// interceptor recognizes it and rotates the access token — an expired
    /// token reads here exactly as an absent one.
    pub fn require(&self) -> async_graphql::Result<Uuid> {
        use async_graphql::ErrorExtensions;
        self.0.ok_or_else(|| {
            async_graphql::Error::new("authentication required")
                .extend_with(|_, e| e.set("code", "UNAUTHENTICATED"))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::jwt::Claims;
    use crate::auth::keys::generate_signing_key;
    use base64::Engine;
    use base64::engine::general_purpose::STANDARD as BASE64;
    use chrono::{Duration, Utc};
    use jsonwebtoken::{Algorithm, EncodingKey, Header};

    /// A keypair plus the base64 PKCS#8 it was built from, so a test can forge
    /// tokens (e.g. an expired one) signed by the *same* key the verifier holds.
    fn keypair() -> (JwtKeys, String) {
        let pkcs8 = generate_signing_key().expect("keygen");
        let keys = JwtKeys::from_pkcs8_base64(&pkcs8).expect("valid key");
        (keys, pkcs8)
    }

    /// Signs an access token with arbitrary `iat`/`exp` using the same key
    /// material the verifier holds — the only way to mint an *expired* token,
    /// since `mint_access` always stamps a live expiry.
    fn sign(pkcs8_b64: &str, sub: Uuid, iat: i64, exp: i64) -> String {
        let pkcs8 = BASE64.decode(pkcs8_b64).expect("decode pkcs8");
        let encoding = EncodingKey::from_ed_der(&pkcs8);
        let claims = Claims {
            sub: sub.to_string(),
            jti: Uuid::new_v4().to_string(),
            iat,
            exp,
        };
        jsonwebtoken::encode(&Header::new(Algorithm::EdDSA), &claims, &encoding).expect("sign")
    }

    #[test]
    fn a_valid_bearer_token_resolves_the_viewer() {
        let (keys, _) = keypair();
        let user = Uuid::new_v4();
        let token = keys.mint_access(user, Uuid::new_v4()).expect("mint");
        let header = format!("Bearer {token}");
        assert_eq!(Viewer::from_bearer(Some(&header), &keys).0, Some(user));
    }

    #[test]
    fn a_missing_header_is_anonymous() {
        let (keys, _) = keypair();
        assert_eq!(Viewer::from_bearer(None, &keys).0, None);
    }

    #[test]
    fn the_wrong_auth_scheme_is_anonymous() {
        let (keys, _) = keypair();
        let token = keys
            .mint_access(Uuid::new_v4(), Uuid::new_v4())
            .expect("mint");
        // A valid token under the wrong scheme still reads as no token.
        assert_eq!(
            Viewer::from_bearer(Some(&format!("Basic {token}")), &keys).0,
            None
        );
        assert_eq!(Viewer::from_bearer(Some(&token), &keys).0, None);
    }

    #[test]
    fn a_malformed_token_is_anonymous() {
        let (keys, _) = keypair();
        assert_eq!(Viewer::from_bearer(Some("Bearer not.a.jwt"), &keys).0, None);
        assert_eq!(Viewer::from_bearer(Some("Bearer "), &keys).0, None);
    }

    #[test]
    fn an_expired_token_is_anonymous() {
        let (keys, pkcs8) = keypair();
        let now = Utc::now();
        // Well past jsonwebtoken's default 60s expiry leeway.
        let token = sign(
            &pkcs8,
            Uuid::new_v4(),
            (now - Duration::hours(1)).timestamp(),
            (now - Duration::minutes(10)).timestamp(),
        );
        assert_eq!(
            Viewer::from_bearer(Some(&format!("Bearer {token}")), &keys).0,
            None,
            "an expired but well-signed token must read as anonymous"
        );
    }
}
