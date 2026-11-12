//! ´mod:module:faults´
//!
//! Every transport fault leaves the process with a declared code
//! (api-spec.md "Errors are tiered"). Server faults collapse to
//! `INTERNAL`, their detail kept in the server log and off the wire; the
//! library's own refusal of an argument it could not parse is the
//! caller's malformed input and answers `BAD_INPUT`.
//!
//! The rule sits once, at the schema, as the async-graphql extension the
//! library documents for post-processing an operation's response, rather
//! than at each resolver: a resolver propagates a store or library error
//! with `?`, and a check every site has to remember is a check some site
//! forgets. It runs on the execute hook, so it sees every error the
//! resolvers produced and none of the parse or validation errors, which
//! are the caller's and keep their messages.
//!
//! What collapses is an error that names no `extensions.code` and carries
//! a Rust error as its source — what async-graphql's blanket `From`
//! conversion builds for a `?` on a typed error. An error that declares
//! its code was shaped for the client on purpose, and passes as it is.
//! An error with neither is what the library builds when a custom
//! scalar's `parse` refuses a value (`InputValueError::into_server_error`:
//! the scalar's message, no source, no extensions) — a malformed UUID, a
//! Dimension off its range or grid — so it is coded `BAD_INPUT` and keeps
//! its message, which names the argument's fault and nothing internal.
//! The resolvers' own refusals declare their codes, so no message the
//! code wrote reaches this rule. A resolver that finds a broken invariant
//! names it as a [`Fault`], which carries its message as a source and so
//! collapses like any other.
//!
//! Type and enum mismatches the library catches at validation, before
//! execution, never reach this hook and stay message-only, like the
//! budget refusals (api-spec.md "Query budgets").

use std::sync::Arc;

use async_graphql::extensions::{Extension, ExtensionContext, ExtensionFactory, NextExecute};
use async_graphql::{ErrorExtensionValues, Response, ServerError};

/// The message every collapsed fault answers with.
pub const INTERNAL_MESSAGE: &str = "internal error";

/// A server-side fault a resolver found itself: an invariant the stores
/// broke, never something the caller could correct. Converted with `?`,
/// it collapses to `INTERNAL` and its text goes to the log.
#[derive(Debug, thiserror::Error)]
#[error("{0}")]
pub struct Fault(pub String);

impl Fault {
    pub fn new(message: impl Into<String>) -> Self {
        Self(message.into())
    }
}

/// The schema extension that collapses server faults.
pub struct InternalFaults;

impl ExtensionFactory for InternalFaults {
    fn create(&self) -> Arc<dyn Extension> {
        Arc::new(InternalFaults)
    }
}

#[async_graphql::async_trait::async_trait]
impl Extension for InternalFaults {
    async fn execute(
        &self,
        ctx: &ExtensionContext<'_>,
        operation_name: Option<&str>,
        next: NextExecute<'_>,
    ) -> Response {
        let mut response = next.run(ctx, operation_name).await;
        for error in &mut response.errors {
            collapse(error);
        }
        response
    }
}

/// Logs a server fault with its cause and rewrites it to the declared
/// internal answer, codes an argument the library refused as
/// `BAD_INPUT`, and leaves a declared error as it is. The path and the
/// locations stay: they name the field that failed, not why.
fn collapse(error: &mut ServerError) {
    let declared = error
        .extensions
        .as_ref()
        .is_some_and(|extensions| extensions.get("code").is_some());
    if declared {
        return;
    }
    if error.source.is_none() {
        error
            .extensions
            .get_or_insert_with(ErrorExtensionValues::default)
            .set("code", "BAD_INPUT");
        return;
    }
    tracing::error!(path = ?error.path, cause = %error.message, "a resolver failed");
    let mut extensions = ErrorExtensionValues::default();
    extensions.set("code", "INTERNAL");
    error.message = INTERNAL_MESSAGE.to_owned();
    error.source = None;
    error.extensions = Some(extensions);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sourced(message: &str) -> ServerError {
        async_graphql::Error::from(Fault::new(message)).into_server_error(Default::default())
    }

    /// An error carrying a Rust error and no code collapses to the
    /// internal answer.
    /// (´claim:server:a-store-fault-collapses-to-internal´)
    #[test]
    fn a_sourced_codeless_error_collapses() {
        let mut error = sourced("relation \"posts\" does not exist");
        collapse(&mut error);
        assert_eq!(error.message, INTERNAL_MESSAGE);
        assert!(error.source.is_none());
        let code = error.extensions.as_ref().and_then(|e| e.get("code"));
        assert_eq!(code, Some(&async_graphql::Value::from("INTERNAL")));
    }

    /// A declared code passes as it is.
    /// (´claim:server:a-declared-code-passes-the-collapse´)
    #[test]
    fn a_declared_error_passes() {
        let mut declared = sourced("not yours");
        declared
            .extensions
            .get_or_insert_with(ErrorExtensionValues::default)
            .set("code", "FORBIDDEN");
        collapse(&mut declared);
        assert_eq!(declared.message, "not yours");
        let code = declared.extensions.as_ref().and_then(|e| e.get("code"));
        assert_eq!(code, Some(&async_graphql::Value::from("FORBIDDEN")));
    }

    /// A codeless error with no source — the library's refusal of an
    /// argument — keeps its message and answers `BAD_INPUT`.
    /// (´claim:server:an-unparsable-argument-is-bad-input´)
    #[test]
    fn a_codeless_plain_error_is_bad_input() {
        let mut plain = ServerError::new("Failed to parse \"UUID\": invalid length", None);
        collapse(&mut plain);
        assert_eq!(plain.message, "Failed to parse \"UUID\": invalid length");
        let code = plain.extensions.as_ref().and_then(|e| e.get("code"));
        assert_eq!(code, Some(&async_graphql::Value::from("BAD_INPUT")));
    }
}
