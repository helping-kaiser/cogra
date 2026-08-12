// The breach-corpus password check (auth.md "Password requirements"):
// a haveibeenpwned-style hash-prefix lookup at registration and password
// change. The trait is the seam, mirroring the Mailer; the real corpus
// is the HIBP Pwned Passwords range API — k-anonymity, so only the
// first five hex characters of the SHA-1 ever leave the process, with
// Add-Padding defeating response-size analysis. Lookups fail OPEN at
// the call site (auth.rs `validate_new_password`).

use std::future::Future;
use std::pin::Pin;

use sha1::{Digest, Sha1};

#[derive(Debug, thiserror::Error)]
pub enum BreachError {
    #[error("corpus request failed: {0}")]
    Transport(#[from] reqwest::Error),
    #[error("corpus answered {0}")]
    Status(reqwest::StatusCode),
}

/// The lookup seam. True means the password appears in the corpus at
/// least once — any occurrence rejects (NIST SP 800-63B: a blocklist
/// match SHALL refuse with the reason).
pub trait BreachCorpus: Send + Sync {
    fn is_breached<'a>(
        &'a self,
        password: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<bool, BreachError>> + Send + 'a>>;
}

/// The disabled corpus (`BREACH_CHECK=off`, development.md): every
/// password passes. For offline dev and rigs that exercise other
/// surfaces — never a production posture.
pub struct DisabledCorpus;

impl BreachCorpus for DisabledCorpus {
    fn is_breached<'a>(
        &'a self,
        _password: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<bool, BreachError>> + Send + 'a>> {
        Box::pin(async { Ok(false) })
    }
}

const HIBP_BASE: &str = "https://api.pwnedpasswords.com/range";
/// Bounds the whole lookup; the flow's fail-open makes a slow corpus a
/// skipped check, never a slow registration.
const LOOKUP_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(2);

/// The live HIBP Pwned Passwords range client — free, keyless, and
/// unmetered per the API docs.
pub struct HibpCorpus {
    client: reqwest::Client,
    base_url: String,
}

impl HibpCorpus {
    pub fn new() -> Result<Self, BreachError> {
        Ok(Self {
            client: reqwest::Client::builder().timeout(LOOKUP_TIMEOUT).build()?,
            base_url: HIBP_BASE.to_string(),
        })
    }

    /// A corpus at a different base URL — the integration tests' seam
    /// for standing in a local range server.
    pub fn with_base_url(base_url: String) -> Result<Self, BreachError> {
        Ok(Self {
            client: reqwest::Client::builder().timeout(LOOKUP_TIMEOUT).build()?,
            base_url,
        })
    }
}

impl BreachCorpus for HibpCorpus {
    fn is_breached<'a>(
        &'a self,
        password: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<bool, BreachError>> + Send + 'a>> {
        Box::pin(async move {
            let digest = hex::encode_upper(Sha1::digest(password.as_bytes()));
            let (prefix, suffix) = digest.split_at(5);
            let response = self
                .client
                .get(format!("{}/{prefix}", self.base_url))
                .header("Add-Padding", "true")
                .send()
                .await?;
            if !response.status().is_success() {
                return Err(BreachError::Status(response.status()));
            }
            let body = response.text().await?;
            Ok(occurrences(&body, suffix) > 0)
        })
    }
}

/// Parses a range response — `SUFFIX:COUNT` lines — and returns the
/// count for the given 35-hex-char suffix. Padding entries carry count
/// 0 and so never report as breached.
fn occurrences(body: &str, suffix: &str) -> u64 {
    body.lines()
        .filter_map(|line| line.split_once(':'))
        .find(|(candidate, _)| candidate.trim().eq_ignore_ascii_case(suffix))
        .and_then(|(_, count)| count.trim().parse().ok())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_listed_suffix_reports_its_count() {
        let body = "0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n\
                    00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2\r\n\
                    011053FD0102E94D6AE2F8B83D76FAF94F6:9999";
        assert_eq!(
            occurrences(body, "011053FD0102E94D6AE2F8B83D76FAF94F6"),
            9999
        );
        assert_eq!(occurrences(body, "0018a45c4d1def81644b54ab7f969b88d65"), 1);
    }

    #[test]
    fn padding_and_absent_suffixes_are_clean() {
        let body = "0018A45C4D1DEF81644B54AB7F969B88D65:0\r\n\
                    00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2";
        // A padding entry (count 0) is not a breach.
        assert_eq!(occurrences(body, "0018A45C4D1DEF81644B54AB7F969B88D65"), 0);
        assert_eq!(occurrences(body, "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"), 0);
        assert_eq!(occurrences("", "ANY"), 0);
        assert_eq!(occurrences("garbage line without colon", "ANY"), 0);
    }

    #[tokio::test]
    async fn the_disabled_corpus_always_passes() {
        assert!(matches!(
            DisabledCorpus.is_breached("password123!").await,
            Ok(false)
        ));
    }
}
