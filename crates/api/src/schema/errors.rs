//! The tiered error model's typed surface
//! ([api-spec.md](../../../docs/implementation/api-spec.md), "Errors are
//! tiered"). `ErrorCode` is the one vocabulary shared across all three tiers;
//! `MutationError` is the interface every result-union error arm implements;
//! the four pre-session auth verbs return the result unions below — a success
//! arm plus typed error arms.
//!
//! Transport faults (tier 1) ride the GraphQL `errors` array with an
//! `extensions.code` instead and so have no type here — see
//! [`ops::internal`](super::ops::internal). Tier 2's per-payload
//! `userErrors: [UserError!]!` has no instance in slice 0 (all four auth verbs
//! are tier-3 unions), so `UserError` lands with the first mutation that needs
//! it.

use async_graphql::{Enum, Interface, SimpleObject, Union};

use super::types::RegisterPayload;
use super::user::AuthPayload;

/// The one error vocabulary, shared across all three error tiers (governing
/// principles): the `extensions.code` on a transport fault, the `code` on a
/// `UserError`, and the `code` on a result-union error arm all draw from it.
/// Grows as gestures add expected failures.
#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum ErrorCode {
    /// No / invalid access token where one is required.
    Unauthenticated,
    /// Authenticated but not eligible (actAs, field-auth).
    Forbidden,
    /// An id resolved to nothing.
    NotFound,
    /// Malformed args, or a constraint not modeled as data.
    BadInput,
    /// An auth endpoint's per-IP / per-account backoff.
    RateLimited,
    /// Collapsed server fault; detail is logged, not surfaced.
    Internal,
    /// Email / password pair did not match.
    InvalidCredentials,
    /// Invite link invalid, expired, revoked, or consumed.
    InviteUnusable,
    /// The requested handle is already in use.
    HandleTaken,
    /// Under the length floor or in the breach corpus.
    WeakPassword,
    /// A live pending registration already holds this email.
    RegistrationInProgress,
    /// Registration verification token invalid or expired.
    VerificationTokenInvalid,
    /// Refresh token invalid, expired, or reuse-detected.
    RefreshTokenInvalid,
}

/// Declares the result-union error arms — each a distinct GraphQL type carrying
/// the same `message` + `code` shape, with `code` fixed by the arm — and the
/// `MutationError` interface that unifies them.
macro_rules! mutation_errors {
    ($($name:ident = $code:ident: $doc:literal;)+) => {
        $(
            #[doc = $doc]
            #[derive(SimpleObject)]
            pub struct $name {
                pub message: String,
                pub code: ErrorCode,
            }
            impl $name {
                /// `code` is fixed by the arm type, so callers supply only the
                /// developer-facing message.
                pub fn new(message: impl Into<String>) -> Self {
                    Self { message: message.into(), code: ErrorCode::$code }
                }
            }
        )+

        /// The shared shape of a result-union error arm: every typed failure of
        /// a union-returning operation implements it, so `message` and `code`
        /// read uniformly across arms while each arm is free to add its own
        /// fields.
        #[derive(Interface)]
        #[graphql(
            field(name = "message", ty = "&String"),
            field(name = "code", ty = "&ErrorCode"),
        )]
        pub enum MutationError {
            $($name($name),)+
        }
    };
}

mutation_errors! {
    InviteUnusable = InviteUnusable: "The invite link is invalid, expired, revoked, or already consumed.";
    HandleTaken = HandleTaken: "The requested handle is already in use.";
    WeakPassword = WeakPassword: "The password is under the length floor or appears in the breach corpus.";
    RegistrationInProgress = RegistrationInProgress: "A live pending registration already holds this email (auth.md).";
    VerificationTokenInvalid = VerificationTokenInvalid: "The verification token is invalid, or its pending registration expired.";
    InvalidCredentials = InvalidCredentials: "The email / password pair did not match.";
    RefreshTokenInvalid = RefreshTokenInvalid: "The refresh token is invalid, expired, or was already rotated (reuse).";
}

/// Result of `register` — the pending-registration receipt, or a typed reason
/// it was refused.
#[derive(Union)]
pub enum RegisterResult {
    Receipt(RegisterPayload),
    InviteUnusable(InviteUnusable),
    HandleTaken(HandleTaken),
    WeakPassword(WeakPassword),
    RegistrationInProgress(RegistrationInProgress),
}

// The success arm (`AuthPayload`) dwarfs the error arms, but the shape is the
// schema's; these are short-lived per-request values, so boxing to even the
// variants out would only obscure the union derive.

/// Result of `verifyEmail` — the first session, or a typed token failure.
#[derive(Union)]
#[allow(clippy::large_enum_variant)]
pub enum VerifyEmailResult {
    Session(AuthPayload),
    VerificationTokenInvalid(VerificationTokenInvalid),
}

/// Result of `logIn` — a session, or rejected credentials.
#[derive(Union)]
#[allow(clippy::large_enum_variant)]
pub enum LogInResult {
    Session(AuthPayload),
    InvalidCredentials(InvalidCredentials),
}

/// Result of `refreshSession` — a rotated session, or a typed token failure. A
/// reuse-detected token revokes every session (auth.md) and surfaces here as
/// REFRESH_TOKEN_INVALID.
#[derive(Union)]
#[allow(clippy::large_enum_variant)]
pub enum RefreshResult {
    Session(AuthPayload),
    RefreshTokenInvalid(RefreshTokenInvalid),
}
