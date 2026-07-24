// Outbound mail (auth.md: verification, reset, and email-change
// messages). The trait is the seam; the dev implementation logs the full
// message — which is also how links and codes surface during hand
// testing. A real SMTP transport is chosen when deployment nears
// (development.md).

use std::future::Future;
use std::pin::Pin;

/// One outbound message. Bodies are plain text carrying the flow's link
/// or code.
#[derive(Debug, Clone)]
pub struct Mail {
    pub to: String,
    pub subject: String,
    pub body: String,
}

/// The delivery seam. Sending is best-effort from the caller's view — a
/// flow never fails because mail did; the user path for a lost message
/// is the resend verb.
pub trait Mailer: Send + Sync {
    fn send(&self, mail: Mail) -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
}

/// Development delivery: the message lands in the log.
pub struct DevMailer;

impl Mailer for DevMailer {
    fn send(&self, mail: Mail) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(async move {
            tracing::info!(
                to = %mail.to,
                subject = %mail.subject,
                body = %mail.body,
                "dev mailer: outbound message"
            );
        })
    }
}
