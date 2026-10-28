//! ´mod:module:smtp´
//!
//! Production delivery: the [`Mailer`] seam over lettre's async SMTP
//! transport on tokio, TLS through rustls (production-deploy O-1, O-2).
//!
//! Three properties hold whatever the server does:
//!
//! - **No secret reaches the log.** A mail's body carries the flow's token,
//!   so the log names the recipient's domain and the subject, never the body
//!   and never the recipient's local part. lettre's own `tracing` feature,
//!   which logs every byte it writes, is off in the workspace manifest.
//! - **The flow never waits for the server.** `send` hands the message to a
//!   task and returns. The silent verbs (password reset, resend
//!   verification) answer the same whether or not an account exists
//!   (auth.md "Password reset"); a send awaited inline would make the
//!   answer for a real account slower by a whole SMTP exchange, and that
//!   difference would tell an attacker which addresses have accounts. The
//!   OWASP Forgot Password Cheat Sheet names the remedy: answer in uniform
//!   time, the send handled asynchronously.
//! - **A failed send is an `error` line, not a failed flow.** The seam is
//!   best-effort ([`Mailer`]); the user path for a lost message is the
//!   resend verb, and the operator's is the `error` line the production log
//!   alert reads (production-deploy §8.2). One delivery is bounded by
//!   `SMTP_TIMEOUT_SECS`, so a stalled server never holds a task.
//!
//! A message still in flight when the process exits is lost, like any other
//! failed send.

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use lettre::message::Mailbox;
use lettre::message::header::ContentType;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

use super::config::SmtpConfig;
use super::{Mail, Mailer};

/// The production transport: lettre's pooled SMTP client on tokio.
pub type SmtpTransport = AsyncSmtpTransport<Tokio1Executor>;

/// Why one delivery did not reach the server.
#[derive(Debug, thiserror::Error)]
pub enum DeliveryError {
    #[error("the recipient is not a valid address: {0}")]
    Recipient(#[source] lettre::address::AddressError),
    #[error("the message could not be built: {0}")]
    Build(#[source] lettre::error::Error),
    #[error("the SMTP server refused or failed the send: {0}")]
    Transport(#[source] Box<dyn std::error::Error + Send + Sync>),
    #[error("the send did not finish within {} s", .0.as_secs())]
    TimedOut(Duration),
}

/// Delivery through an SMTP server, from one sender. Cloning shares the
/// transport and its connection pool.
pub struct SmtpMailer<T = SmtpTransport> {
    inner: Arc<Inner<T>>,
}

impl<T> Clone for SmtpMailer<T> {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
        }
    }
}

struct Inner<T> {
    transport: T,
    from: Mailbox,
    timeout: Duration,
}

impl SmtpMailer<SmtpTransport> {
    /// The mailer the configuration names. Builds the pooled transport;
    /// nothing is dialed until the first send.
    pub fn from_config(config: &SmtpConfig) -> Result<Self, lettre::transport::smtp::Error> {
        let transport = SmtpTransport::from_url(config.url())?
            .timeout(Some(config.timeout()))
            .build();
        Ok(Self::with_transport(
            transport,
            config.from().clone(),
            config.timeout(),
        ))
    }

    /// Dials the server, greets it, secures and authenticates the link as
    /// the URL says, and sends NOOP — the boot-time check that the
    /// configuration reaches a server that accepts it. Logged, never fatal:
    /// a provider outage at boot must not keep the API down.
    pub async fn check_connection(&self) {
        let timeout = self.inner.timeout;
        match tokio::time::timeout(timeout, self.inner.transport.test_connection()).await {
            Ok(Ok(true)) => tracing::info!("SMTP server reachable and accepting"),
            Ok(Ok(false)) => tracing::error!("SMTP server answered the check negatively"),
            Ok(Err(e)) => tracing::error!(error = %e, "SMTP server check failed"),
            Err(_) => tracing::error!(
                timeout_secs = timeout.as_secs(),
                "SMTP server check timed out"
            ),
        }
    }
}

impl<T> SmtpMailer<T>
where
    T: AsyncTransport + Send + Sync + 'static,
    T::Error: std::error::Error + Send + Sync + 'static,
{
    /// The mailer over any lettre transport — the stub transport in tests.
    pub fn with_transport(transport: T, from: Mailbox, timeout: Duration) -> Self {
        Self {
            inner: Arc::new(Inner {
                transport,
                from,
                timeout,
            }),
        }
    }

    /// Builds the message and hands it to the server, bounded by the
    /// timeout. The awaited form of the seam's send, for tests and for any
    /// caller that wants the outcome.
    pub async fn deliver(&self, mail: Mail) -> Result<(), DeliveryError> {
        self.inner.deliver(mail).await
    }
}

impl<T> Inner<T>
where
    T: AsyncTransport + Send + Sync + 'static,
    T::Error: std::error::Error + Send + Sync + 'static,
{
    async fn deliver(&self, mail: Mail) -> Result<(), DeliveryError> {
        let message = self.message(mail)?;
        match tokio::time::timeout(self.timeout, self.transport.send(message)).await {
            Ok(Ok(_)) => Ok(()),
            Ok(Err(e)) => Err(DeliveryError::Transport(Box::new(e))),
            Err(_) => Err(DeliveryError::TimedOut(self.timeout)),
        }
    }

    /// One RFC 5322 message: `From` is `MAIL_FROM`, `To` the recipient,
    /// the subject as given, and the body as plain UTF-8 text. The
    /// Message-ID is minted on the sender's domain rather than the host
    /// name lettre would use, which inside a container is a random id.
    fn message(&self, mail: Mail) -> Result<Message, DeliveryError> {
        let to: Mailbox = mail.to.parse().map_err(DeliveryError::Recipient)?;
        Message::builder()
            .from(self.from.clone())
            .to(to)
            .subject(mail.subject)
            .message_id(Some(format!(
                "<{}@{}>",
                uuid::Uuid::new_v4(),
                self.from.email.domain()
            )))
            .header(ContentType::TEXT_PLAIN)
            .body(mail.body)
            .map_err(DeliveryError::Build)
    }

    /// Delivers and logs the outcome: the recipient's domain and the
    /// subject, never the body or the local part.
    async fn deliver_logged(&self, mail: Mail) {
        let domain = recipient_domain(&mail.to).to_string();
        let subject = mail.subject.clone();
        match self.deliver(mail).await {
            Ok(()) => tracing::info!(
                recipient_domain = %domain,
                subject = %subject,
                "mail sent"
            ),
            Err(e) => tracing::error!(
                recipient_domain = %domain,
                subject = %subject,
                error = %e,
                "mail delivery failed"
            ),
        }
    }
}

impl<T> Mailer for SmtpMailer<T>
where
    T: AsyncTransport + Send + Sync + 'static,
    T::Error: std::error::Error + Send + Sync + 'static,
{
    fn send(&self, mail: Mail) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        let inner = Arc::clone(&self.inner);
        Box::pin(async move {
            tokio::spawn(async move { inner.deliver_logged(mail).await });
        })
    }
}

/// The part of an address after its last `@` — what the log may name.
fn recipient_domain(address: &str) -> &str {
    address
        .rsplit_once('@')
        .map_or("(no domain)", |(_, domain)| domain)
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use base64::Engine;
    use chrono::TimeZone;
    use lettre::transport::stub::AsyncStubTransport;
    use uuid::Uuid;

    use super::*;

    const ORIGIN: &str = "https://cogra.example";
    const TOKEN: &str = "tok3n-c4pab1lity-xyz";

    fn sender() -> Mailbox {
        "CoGra <no-reply@cogra.example>".parse().expect("sender")
    }

    fn mailer(transport: AsyncStubTransport) -> SmtpMailer<AsyncStubTransport> {
        SmtpMailer::with_transport(transport, sender(), Duration::from_secs(5))
    }

    /// Every transactional mail the server composes, by kind.
    fn every_kind() -> Vec<(&'static str, Mail)> {
        let to = || "reader@example.org".to_string();
        let at = chrono::Utc
            .with_ymd_and_hms(2026, 10, 28, 12, 0, 0)
            .single()
            .expect("time");
        vec![
            (
                "signup verification",
                crate::onboarding::signup_verification_mail(to(), ORIGIN, TOKEN),
            ),
            (
                "resend verification",
                crate::onboarding::resend_verification_mail(to(), ORIGIN, TOKEN),
            ),
            (
                "password reset",
                crate::schema::reset_mail(to(), ORIGIN, TOKEN),
            ),
            (
                "email-change code",
                crate::schema::code_mail(to(), "123456"),
            ),
            (
                "email-change link",
                crate::schema::link_mail(to(), true, ORIGIN, TOKEN),
            ),
            (
                "email-change carve-out verification",
                crate::schema::link_mail(to(), false, ORIGIN, TOKEN),
            ),
            (
                "account deletion",
                crate::schema::deletion_mail(to(), ORIGIN, TOKEN),
            ),
            (
                "recovery code replaced",
                crate::schema::recovery_code_replaced_mail(to()),
            ),
            (
                "content report",
                crate::report::report_mail(Uuid::nil(), "reporter", Uuid::max(), "post", at),
            ),
        ]
    }

    /// The raw message split into unfolded headers and the decoded body,
    /// as a mail client presents them.
    fn read(raw: &str) -> (Vec<(String, String)>, String) {
        let (head, body) = raw.split_once("\r\n\r\n").expect("header/body split");
        let unfolded = head.replace("\r\n ", " ").replace("\r\n\t", " ");
        let headers: Vec<(String, String)> = unfolded
            .split("\r\n")
            .map(|line| {
                let (name, value) = line.split_once(": ").expect("header line");
                (name.to_ascii_lowercase(), value.to_string())
            })
            .collect();
        let encoding = header(&headers, "content-transfer-encoding");
        let decoded = match encoding.as_str() {
            "7bit" | "8bit" => body.to_string(),
            "quoted-printable" => String::from_utf8(
                quoted_printable::decode(body, quoted_printable::ParseMode::Robust)
                    .expect("quoted-printable body"),
            )
            .expect("utf-8 body"),
            "base64" => String::from_utf8(
                base64::engine::general_purpose::STANDARD
                    .decode(body.replace("\r\n", ""))
                    .expect("base64 body"),
            )
            .expect("utf-8 body"),
            other => panic!("unexpected transfer encoding {other}"),
        };
        (headers, decoded.replace("\r\n", "\n"))
    }

    fn header(headers: &[(String, String)], name: &str) -> String {
        headers
            .iter()
            .find(|(n, _)| n == name)
            .map(|(_, v)| v.clone())
            .unwrap_or_else(|| panic!("no {name} header"))
    }

    /// Every mail kind the server sends leaves as one RFC 5322 message
    /// whose envelope and headers carry MAIL_FROM and the recipient, whose
    /// subject is the flow's, and whose plain-text body decodes to exactly
    /// the body the flow composed — the long deletion line and the
    /// recovery notice's non-ASCII dash included. Its Message-ID is minted
    /// on the sender's domain.
    ///
    /// Each mail kind is built from MAIL_FROM, the recipient, the subject and the plain-text body.
    /// ´claim:mail:smtp-builds-the-message-from-the-mail´
    #[tokio::test]
    async fn smtp_mailer_builds_the_message_from_the_mail() {
        for (kind, mail) in every_kind() {
            let smtp = mailer(AsyncStubTransport::new_ok());
            smtp.deliver(mail.clone())
                .await
                .unwrap_or_else(|e| panic!("{kind}: {e}"));

            let sent = smtp.inner.transport.messages().await;
            assert_eq!(sent.len(), 1, "{kind}");
            let (envelope, raw) = &sent[0];
            assert_eq!(
                envelope.from().map(ToString::to_string).as_deref(),
                Some("no-reply@cogra.example"),
                "{kind}"
            );
            let recipients: Vec<String> = envelope.to().iter().map(ToString::to_string).collect();
            assert_eq!(recipients, vec![mail.to.clone()], "{kind}");

            let (headers, body) = read(raw);
            assert_eq!(header(&headers, "from"), "CoGra <no-reply@cogra.example>", "{kind}");
            assert_eq!(header(&headers, "to"), mail.to, "{kind}");
            assert_eq!(header(&headers, "subject"), mail.subject, "{kind}");
            assert_eq!(
                header(&headers, "content-type"),
                "text/plain; charset=utf-8",
                "{kind}"
            );
            assert!(
                header(&headers, "message-id").ends_with("@cogra.example>"),
                "{kind}"
            );
            assert!(!header(&headers, "date").is_empty(), "{kind}");
            assert_eq!(body, mail.body, "{kind}");
        }
    }

    /// A tracing subscriber writing into a buffer the test reads back. The
    /// guard keeps it the thread's default; a current-thread runtime runs
    /// the spawned delivery on that thread.
    fn capture() -> (Arc<Mutex<Vec<u8>>>, tracing::subscriber::DefaultGuard) {
        let buffer = Arc::new(Mutex::new(Vec::new()));
        let writer = Arc::clone(&buffer);
        let subscriber = tracing_subscriber::fmt()
            .with_max_level(tracing::Level::TRACE)
            .with_ansi(false)
            .with_writer(move || CaptureWriter(Arc::clone(&writer)))
            .finish();
        (buffer, tracing::subscriber::set_default(subscriber))
    }

    struct CaptureWriter(Arc<Mutex<Vec<u8>>>);

    impl std::io::Write for CaptureWriter {
        fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
            self.0.lock().expect("log buffer").extend_from_slice(bytes);
            Ok(bytes.len())
        }

        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    fn logged(buffer: &Mutex<Vec<u8>>) -> String {
        String::from_utf8(buffer.lock().expect("log buffer").clone()).expect("utf-8 log")
    }

    /// Lets the spawned delivery run to its end on this thread.
    async fn settle() {
        for _ in 0..16 {
            tokio::task::yield_now().await;
        }
    }

    /// A sent mail logs the recipient's domain and the subject at info,
    /// and no line at any level carries the body's token or the
    /// recipient's local part.
    ///
    /// The SMTP mailer logs the recipient domain and subject, never the body or the local part.
    /// ´claim:mail:smtp-logs-no-body´
    #[tokio::test]
    async fn smtp_mailer_logs_no_body() {
        let (buffer, _guard) = capture();
        let smtp = mailer(AsyncStubTransport::new_ok());
        smtp.send(crate::schema::reset_mail(
            "reader@example.org".into(),
            ORIGIN,
            TOKEN,
        ))
        .await;
        settle().await;

        assert_eq!(smtp.inner.transport.messages().await.len(), 1);
        let log = logged(&buffer);
        assert!(log.contains("mail sent"), "{log}");
        assert!(log.contains("example.org"), "{log}");
        assert!(log.contains("Reset your CoGra password"), "{log}");
        assert!(!log.contains(TOKEN), "{log}");
        assert!(!log.contains("reader@"), "{log}");
    }

    /// A transport that fails makes the send log one error naming the
    /// recipient's domain, the subject and the cause, and the seam's send
    /// still returns, so the flow that mailed carries on.
    ///
    /// A failed send is logged at error and the flow carries on.
    /// ´claim:mail:a-failed-send-logs-an-error-and-the-flow-carries-on´
    #[tokio::test]
    async fn a_failed_send_logs_an_error_and_the_flow_carries_on() {
        let (buffer, _guard) = capture();
        let smtp = mailer(AsyncStubTransport::new_error());
        let mail = crate::schema::reset_mail("reader@example.org".into(), ORIGIN, TOKEN);

        assert!(matches!(
            smtp.deliver(mail.clone()).await,
            Err(DeliveryError::Transport(_))
        ));
        smtp.send(mail).await;
        settle().await;

        let log = logged(&buffer);
        assert!(log.contains("ERROR"), "{log}");
        assert!(log.contains("mail delivery failed"), "{log}");
        assert!(log.contains("example.org"), "{log}");
        assert!(!log.contains(TOKEN), "{log}");
    }

    /// A recipient that is not an address is refused before anything is
    /// sent, and the log names no local part for it either.
    ///
    /// A malformed recipient is refused before the transport sees it.
    /// ´claim:mail:a-malformed-recipient-is-refused-before-sending´
    #[tokio::test]
    async fn a_malformed_recipient_is_refused_before_sending() {
        let smtp = mailer(AsyncStubTransport::new_ok());
        let mail = Mail {
            to: "not an address".into(),
            subject: "s".into(),
            body: "b".into(),
        };
        assert!(matches!(
            smtp.deliver(mail).await,
            Err(DeliveryError::Recipient(_))
        ));
        assert!(smtp.inner.transport.messages().await.is_empty());
        assert_eq!(recipient_domain("not an address"), "(no domain)");
        assert_eq!(recipient_domain("a@b@example.org"), "example.org");
    }
}
