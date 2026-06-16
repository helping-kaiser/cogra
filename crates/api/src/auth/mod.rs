//! Server-side authentication (auth.md): Argon2id passwords, Ed25519 JWT
//! access tokens, SHA-256-hashed rotating refresh tokens, and the per-request
//! viewer resolved from the `Authorization` header.

pub mod jwt;
pub mod keys;
pub mod password;
pub mod policy;
pub mod tokens;

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

    /// The authenticated user id, or a "must be authenticated" error for the
    /// mutations that require a session.
    pub fn require(&self) -> async_graphql::Result<Uuid> {
        self.0
            .ok_or_else(|| async_graphql::Error::new("authentication required"))
    }
}
