//! The two-tier error model
//! ([api-spec.md](../../../docs/implementation/api-spec.md), "Errors are
//! tiered"). `ErrorCode` is the one vocabulary shared across both tiers;
//! `UserError` is the per-payload business-failure list every mutation carries.
//!
//! Transport faults (tier 1) ride the GraphQL `errors` array with an
//! `extensions.code` rather than a payload type: resolver faults are tagged
//! `INTERNAL` by [`ops::internal`](super::ops::internal), and the
//! [`ErrorCodes`] extension tags pre-execution parse / validation errors
//! `BAD_INPUT`, so every top-level error carries a code.

use std::sync::Arc;

use async_graphql::async_trait::async_trait;
use async_graphql::extensions::{
    Extension, ExtensionContext, ExtensionFactory, NextParseQuery, NextRequest, NextValidation,
};
use async_graphql::parser::types::ExecutableDocument;
use async_graphql::{
    Enum, Response, ServerError, ServerResult, SimpleObject, ValidationResult, Variables,
};

/// The one error vocabulary, shared across both error tiers (governing
/// principles): the `extensions.code` on a transport fault and the `code` on a
/// `UserError` both draw from it. Grows as gestures add expected failures.
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

/// A recoverable, expected failure of a mutation — a bad value or a
/// business-rule rejection the end user should see and act on. A payload's
/// `userErrors` is empty exactly when the mutation succeeded; a non-empty list
/// means the named result field is null.
#[derive(SimpleObject, Clone, Debug)]
pub struct UserError {
    /// Developer-facing fallback text; the client localizes off `code`.
    pub message: String,
    /// The stable code the client switches on.
    pub code: ErrorCode,
    /// Path to the offending input field — e.g. `["declaredGoal"]`; null for a
    /// whole-operation failure.
    pub field: Option<Vec<String>>,
}

impl UserError {
    /// A failure on a single named input field (the GraphQL field name).
    pub fn input(code: ErrorCode, field: &str, message: impl Into<String>) -> Self {
        UserError {
            message: message.into(),
            code,
            field: Some(vec![field.to_string()]),
        }
    }

    /// A whole-operation failure not pinned to one input field.
    pub fn whole(code: ErrorCode, message: impl Into<String>) -> Self {
        UserError {
            message: message.into(),
            code,
            field: None,
        }
    }
}

/// Schema extension that gives every top-level transport error a stable
/// `extensions.code` (governing principles, tier 1). Parse and validation
/// errors fire before any resolver runs, so this tags them `BAD_INPUT`; any
/// other error that reaches the response without a code defaults to `INTERNAL`
/// (resolver faults already set theirs via
/// [`ops::internal`](super::ops::internal), which this leaves untouched).
pub struct ErrorCodes;

impl ExtensionFactory for ErrorCodes {
    fn create(&self) -> Arc<dyn Extension> {
        Arc::new(ErrorCodesExt)
    }
}

struct ErrorCodesExt;

/// Sets `extensions.code` to `default` unless the error already carries one.
fn ensure_code(mut err: ServerError, default: &str) -> ServerError {
    let mut extensions = err.extensions.take().unwrap_or_default();
    if extensions.get("code").is_none() {
        extensions.set("code", default);
    }
    err.extensions = Some(extensions);
    err
}

#[async_trait]
impl Extension for ErrorCodesExt {
    async fn request(&self, ctx: &ExtensionContext<'_>, next: NextRequest<'_>) -> Response {
        let mut response = next.run(ctx).await;
        response.errors = response
            .errors
            .into_iter()
            .map(|err| ensure_code(err, "INTERNAL"))
            .collect();
        response
    }

    async fn parse_query(
        &self,
        ctx: &ExtensionContext<'_>,
        query: &str,
        variables: &Variables,
        next: NextParseQuery<'_>,
    ) -> ServerResult<ExecutableDocument> {
        next.run(ctx, query, variables)
            .await
            .map_err(|err| ensure_code(err, "BAD_INPUT"))
    }

    async fn validation(
        &self,
        ctx: &ExtensionContext<'_>,
        next: NextValidation<'_>,
    ) -> Result<ValidationResult, Vec<ServerError>> {
        next.run(ctx).await.map_err(|errors| {
            errors
                .into_iter()
                .map(|err| ensure_code(err, "BAD_INPUT"))
                .collect()
        })
    }
}
