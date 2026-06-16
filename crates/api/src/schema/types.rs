//! GraphQL type system for slice 0 — the auth/account surface
//! ([api-spec.md](../../../docs/implementation/api-spec.md)). The broader
//! node catalog (Post, Comment, the `Node`/`Actor` interfaces, …) arrives in
//! later slices as their resolvers do; this file carries only what
//! register / verifyEmail / logIn / refreshSession / me need.

use async_graphql::{
    Enum, InputObject, InputValueError, InputValueResult, Scalar, ScalarType, SimpleObject, Value,
};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::errors::UserError;

#[derive(Clone, Copy, Debug)]
pub struct Dimension(pub f64);

/// A signed edge-tensor dimension: a float constrained to the closed range
/// [-1.0, +1.0]. The range invariant lives in the type rather than in a plain
/// Float.
#[Scalar]
impl ScalarType for Dimension {
    fn parse(value: Value) -> InputValueResult<Self> {
        match value {
            Value::Number(n) => {
                let f = n
                    .as_f64()
                    .ok_or_else(|| InputValueError::custom("Dimension must be a number"))?;
                if (-1.0..=1.0).contains(&f) {
                    Ok(Dimension(f))
                } else {
                    Err(InputValueError::custom(
                        "Dimension must lie within [-1.0, +1.0]",
                    ))
                }
            }
            other => Err(InputValueError::expected_type(other)),
        }
    }

    fn to_value(&self) -> Value {
        Value::from(self.0)
    }
}

/// Network-scope role for a User.
#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum NetworkRole {
    Member,
    Moderator,
}

impl From<common::NetworkRole> for NetworkRole {
    fn from(role: common::NetworkRole) -> Self {
        match role {
            common::NetworkRole::Member => NetworkRole::Member,
            common::NetworkRole::Moderator => NetworkRole::Moderator,
        }
    }
}

/// A node's moderation state — the cached max severity across its per-field
/// statuses.
#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum ModerationStatus {
    Normal,
    Sensitive,
    Illegal,
}

impl ModerationStatus {
    /// Maps the graph's `moderation_status` cache string; an unknown value
    /// falls back to `NORMAL` rather than erroring a read.
    pub fn from_graph(value: &str) -> Self {
        match value {
            "sensitive" => ModerationStatus::Sensitive,
            "illegal" => ModerationStatus::Illegal,
            _ => ModerationStatus::Normal,
        }
    }
}

/// Per-field moderation state.
#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum FieldModerationStatus {
    Normal,
    Sensitive,
    Redacted,
}

/// Text carrying its own moderation status. `value` is null when the field is
/// redacted, or unset where the field is optional — `status` disambiguates.
#[derive(SimpleObject, Clone, Debug)]
pub struct ModeratedText {
    pub value: Option<String>,
    pub status: FieldModerationStatus,
}

impl ModeratedText {
    /// A present, unmoderated value (slice 0 writes nothing else — there is no
    /// moderation path yet).
    pub fn normal(value: impl Into<String>) -> Self {
        ModeratedText {
            value: Some(value.into()),
            status: FieldModerationStatus::Normal,
        }
    }

    /// An optional field: present-and-normal, or unset.
    pub fn optional(value: Option<String>) -> Self {
        ModeratedText {
            value,
            status: FieldModerationStatus::Normal,
        }
    }
}

/// An active authentication session — one per refresh token.
#[derive(SimpleObject, Clone, Debug)]
pub struct Session {
    pub id: Uuid,
    pub device_label: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
    /// Whether this is the session that issued the current request.
    pub is_current: bool,
}

impl Session {
    /// Builds the payload `Session` from a freshly issued refresh-token row.
    /// `is_current` is true: a just-issued session is the one making the call.
    pub fn issued(row: postgres_store::auth::RefreshToken) -> Self {
        Session {
            id: row.id,
            device_label: row.device_label,
            created_at: row.created_at,
            last_used_at: row.last_used_at,
            expires_at: row.expires_at,
            is_current: true,
        }
    }
}

/// The pending registration's receipt; no User node or session exists yet
/// (both arrive at verifyEmail). On refusal `expires_at` is null and
/// `user_errors` carries the reason.
#[derive(SimpleObject, Clone, Debug)]
pub struct RegisterPayload {
    /// When the pending registration expires unverified (24 h, auth.md); null
    /// when the registration was refused.
    pub expires_at: Option<DateTime<Utc>>,
    pub user_errors: Vec<UserError>,
}

impl RegisterPayload {
    pub fn ok(expires_at: DateTime<Utc>) -> Self {
        RegisterPayload {
            expires_at: Some(expires_at),
            user_errors: Vec::new(),
        }
    }
    pub fn err(error: UserError) -> Self {
        RegisterPayload {
            expires_at: None,
            user_errors: vec![error],
        }
    }
}

/// Register through an invite link.
#[derive(InputObject)]
pub struct RegisterInput {
    pub invite_link: Uuid,
    pub handle: String,
    pub email: String,
    pub password: String,
    /// The invitee's own outgoing edge toward the inviter. Null means an
    /// explicit skip: the `(+0.5, +0.5)` fallback (invitations.md).
    pub dim1: Option<Dimension>,
    pub dim2: Option<Dimension>,
}

#[derive(InputObject)]
pub struct VerifyEmailInput {
    pub verification_token: String,
    pub device_label: Option<String>,
}

#[derive(InputObject)]
pub struct LogInInput {
    pub email: String,
    pub password: String,
    pub device_label: Option<String>,
}

#[derive(InputObject)]
pub struct RefreshSessionInput {
    pub refresh_token: String,
}
