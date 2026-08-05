// Outbound mail (auth.md: verification, reset, and email-change
// messages). The trait is the seam; the dev implementation logs the full
// message — which is also how links and codes surface during hand
// testing — and, when a log file is configured, appends it there too
// (`DEV_MAILER_LOG`, development.md). A real SMTP transport is chosen
// when deployment nears (development.md).

use std::future::Future;
use std::path::{Path, PathBuf};
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

/// Development delivery: the message lands in the log and, when a log
/// file is configured, is appended there — one place to read out-of-band
/// secrets during hand tests instead of grepping the process log.
pub struct DevMailer {
    log_file: Option<PathBuf>,
}

impl DevMailer {
    /// `log_file` unset means no file logging (the process log only).
    pub fn new(log_file: Option<PathBuf>) -> Self {
        Self { log_file }
    }
}

impl Mailer for DevMailer {
    fn send(&self, mail: Mail) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(async move {
            tracing::info!(
                to = %mail.to,
                subject = %mail.subject,
                body = %mail.body,
                "dev mailer: outbound message"
            );
            if let Some(path) = &self.log_file {
                // Best-effort like the send itself: a file problem must
                // never fail the flow that mailed.
                if let Err(e) = append(path, &mail).await {
                    tracing::warn!(
                        error = %e,
                        path = %path.display(),
                        "dev mailer: appending to the log file failed"
                    );
                }
            }
        })
    }
}

/// One entry: a `timestamp | to | subject` header line, the body, a
/// blank separator line.
async fn append(path: &Path, mail: &Mail) -> std::io::Result<()> {
    use tokio::io::AsyncWriteExt;

    if let Some(parent) = path.parent()
        && !parent.as_os_str().is_empty()
    {
        tokio::fs::create_dir_all(parent).await?;
    }
    let entry = format!(
        "{} | to: {} | subject: {}\n{}\n\n",
        chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
        mail.to,
        mail.subject,
        mail.body,
    );
    let mut file = tokio::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .await?;
    file.write_all(entry.as_bytes()).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mail(to: &str, subject: &str, body: &str) -> Mail {
        Mail {
            to: to.into(),
            subject: subject.into(),
            body: body.into(),
        }
    }

    #[tokio::test]
    async fn appends_each_message_to_the_configured_file() {
        // A missing parent directory is part of the test: tmp_dev/ does
        // not exist on a fresh checkout.
        let dir = std::env::temp_dir().join(format!("cogra-mailer-{}", uuid::Uuid::new_v4()));
        let path = dir.join("nested").join("mailer.log");
        let mailer = DevMailer::new(Some(path.clone()));

        mailer
            .send(mail("a@example.com", "first", "token 111"))
            .await;
        mailer
            .send(mail("b@example.com", "second", "token 222"))
            .await;

        let logged = tokio::fs::read_to_string(&path).await.expect("log file");
        let header = logged.lines().next().expect("header line");
        let (timestamp, rest) = header.split_once(" | ").expect("timestamped header");
        chrono::DateTime::parse_from_rfc3339(timestamp).expect("RFC 3339 timestamp");
        assert_eq!(rest, "to: a@example.com | subject: first");
        assert!(logged.contains("token 111"));
        assert!(logged.contains("to: b@example.com | subject: second"));
        assert!(logged.contains("token 222"));
        let first = logged.find("token 111").expect("first body");
        let second = logged.find("token 222").expect("second body");
        assert!(first < second, "entries append in send order");

        tokio::fs::remove_dir_all(&dir).await.ok();
    }

    #[tokio::test]
    async fn without_a_configured_file_only_the_log_line_is_emitted() {
        // The unset path must stay a plain log-and-return: no file, no
        // directory, no error.
        DevMailer::new(None)
            .send(mail("a@example.com", "subject", "body"))
            .await;
    }
}
