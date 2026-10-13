//! ´mod:module:report´
//!
//! The MVP's content report (api-spec.md `sendReport`): no report
//! machinery — moderation proposals come with slice 8's moderation half —
//! only a mail to the people who run CoGra. The mail carries who reported,
//! what, and when, and nothing more: no free text, no reason, no content
//! snapshot and no reply address.
//!
//! What a report names is read off the registries, never taken from the
//! client, and a refused target spends no budget and mails nothing. The
//! send is best-effort like every mail (`mailer.rs`): a report is answered
//! as sent whatever the transport did with it.

use chrono::{DateTime, SecondsFormat, Utc};
use uuid::Uuid;

use crate::mailer::Mail;

/// Where content reports go: a placeholder in the `@cogra.local` family
/// the other drawn addresses use, swapped for a real mailbox at
/// publication beside them. It is deliberately not the Report-a-problem
/// address: reporting content must never read as reporting the app.
pub const CONTENT_REPORT_ADDRESS: &str = "content-reports@cogra.local";

/// The report's mail: the reporter's account id and handle, the reported
/// node's id and kind, and the server's UTC time of the report — one fact
/// per line, so the inbox reads it at a glance.
pub fn report_mail(
    reporter: Uuid,
    reporter_handle: &str,
    target: Uuid,
    kind: &str,
    at: DateTime<Utc>,
) -> Mail {
    Mail {
        to: CONTENT_REPORT_ADDRESS.into(),
        subject: format!("CoGra content report: {kind} {target}"),
        body: format!(
            "Reporter: {reporter} (@{reporter_handle})\nReported: {kind} {target}\nAt: {}",
            at.to_rfc3339_opts(SecondsFormat::Secs, true)
        ),
    }
}
