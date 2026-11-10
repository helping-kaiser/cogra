//! ´mod:module:faults´
//!
//! Server faults collapse to the declared `INTERNAL` answer before they
//! leave the process (api-spec.md "Errors are tiered"): internal detail
//! stays in the server log and never reaches the client.
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
//! its code was shaped for the client on purpose. An error with neither
//! is a message the code wrote itself or the library's own refusal of an
//! argument it could not parse; neither carries internal detail. A
//! resolver that finds a broken invariant names it as a [`Fault`], which
//! carries its message as a source and so collapses like any other.

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
/// internal answer; leaves every other error as it is. The path and the
/// locations stay: they name the field that failed, not why.
fn collapse(error: &mut ServerError) {
    let declared = error
        .extensions
        .as_ref()
        .is_some_and(|extensions| extensions.get("code").is_some());
    if declared || error.source.is_none() {
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

    /// A declared code, or a plain message with no source, passes as it is.
    /// (´claim:server:a-declared-code-passes-the-collapse´)
    #[test]
    fn a_declared_or_plain_error_passes() {
        let mut declared = sourced("not yours");
        declared
            .extensions
            .get_or_insert_with(ErrorExtensionValues::default)
            .set("code", "FORBIDDEN");
        collapse(&mut declared);
        assert_eq!(declared.message, "not yours");

        let mut plain = ServerError::new("invalid cursor", None);
        collapse(&mut plain);
        assert_eq!(plain.message, "invalid cursor");
        assert!(plain.extensions.is_none());
    }
}
