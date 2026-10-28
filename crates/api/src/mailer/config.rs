//! ´mod:module:mailer-config´
//!
//! Which mailer the server sends through, read from the environment at
//! boot (development.md "Environment Variables").
//!
//! `MAILER` picks the implementation: `dev`, the default, logs every
//! message; `smtp` delivers through `SMTP_URL` from `MAIL_FROM`. A
//! configuration that cannot be what the operator meant is refused at boot
//! instead of mailing the wrong way:
//!
//! - `MAILER=smtp` without `SMTP_URL` or `MAIL_FROM`.
//! - `SMTP_URL` set while `MAILER` is `dev`. The operator who set it expects
//!   mail to leave the box, and the dev mailer would instead write every
//!   token into the process log.
//! - Credentials on a link that is not encrypted from the first command:
//!   lettre sends them over plain `smtp://` and over `tls=opportunistic`
//!   when the server offers no STARTTLS (its `from_url` sets credentials
//!   whatever the scheme). They need `smtps://` or `?tls=required`.
//!
//! Nothing here ever prints `SMTP_URL`: it carries the provider's password,
//! so the refusals name the rule that failed and never the value, and
//! [`SmtpConfig`]'s `Debug` shows the endpoint without it.

use std::fmt;
use std::path::PathBuf;
use std::time::Duration;

use lettre::message::Mailbox;

/// The mailer the environment names.
#[derive(Debug)]
pub enum MailerConfig {
    /// The development mailer: log, and append to `DEV_MAILER_LOG` when set.
    Dev {
        /// `DEV_MAILER_LOG`, the optional file every message is appended to.
        log_file: Option<PathBuf>,
    },
    /// Delivery through an SMTP server.
    Smtp(SmtpConfig),
}

/// How the link to the SMTP server is secured, as `SMTP_URL` states it in
/// lettre's URL form (`scheme://user:pass@host:port/ehlo-name?tls=…`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SmtpSecurity {
    /// `smtps://`: TLS from the first byte, port 465 by default.
    ImplicitTls,
    /// `smtp://…?tls=required`: STARTTLS or no session, port 587 by default.
    StartTlsRequired,
    /// `smtp://…?tls=opportunistic`: STARTTLS when offered, port 587 by
    /// default. Allowed only without credentials.
    StartTlsOpportunistic,
    /// `smtp://`: no encryption, port 25 by default — a relay on the same
    /// host. Allowed only without credentials.
    Plain,
}

impl SmtpSecurity {
    /// The port lettre dials when the URL names none.
    fn default_port(self) -> u16 {
        match self {
            Self::ImplicitTls => 465,
            Self::StartTlsRequired | Self::StartTlsOpportunistic => 587,
            Self::Plain => 25,
        }
    }

    /// The name the boot log and the docs use.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ImplicitTls => "implicit-tls",
            Self::StartTlsRequired => "starttls-required",
            Self::StartTlsOpportunistic => "starttls-opportunistic",
            Self::Plain => "plain",
        }
    }
}

/// The SMTP delivery settings. The URL is private and never printed.
#[derive(Clone)]
pub struct SmtpConfig {
    url: String,
    host: String,
    port: u16,
    security: SmtpSecurity,
    authenticated: bool,
    from: Mailbox,
    timeout: Duration,
}

impl SmtpConfig {
    /// The server's host name, without credentials.
    pub fn host(&self) -> &str {
        &self.host
    }

    /// The port dialed: the URL's, or the scheme's default.
    pub fn port(&self) -> u16 {
        self.port
    }

    /// How the link is secured.
    pub fn security(&self) -> SmtpSecurity {
        self.security
    }

    /// Whether the URL carries credentials.
    pub fn authenticated(&self) -> bool {
        self.authenticated
    }

    /// `MAIL_FROM`, the sender every message carries.
    pub fn from(&self) -> &Mailbox {
        &self.from
    }

    /// `SMTP_TIMEOUT_SECS`, the bound on one delivery.
    pub fn timeout(&self) -> Duration {
        self.timeout
    }

    /// The URL itself, for building the transport only.
    pub(super) fn url(&self) -> &str {
        &self.url
    }
}

impl fmt::Debug for SmtpConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SmtpConfig")
            .field("host", &self.host)
            .field("port", &self.port)
            .field("security", &self.security)
            .field("authenticated", &self.authenticated)
            .field("from", &self.from.to_string())
            .field("timeout", &self.timeout)
            .finish_non_exhaustive()
    }
}

/// Why the environment names no usable mailer. Every message names the
/// variable and the rule, never the value of `SMTP_URL`.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum MailerConfigError {
    #[error("MAILER must be `dev` or `smtp`, not `{0}`")]
    UnknownMailer(String),
    #[error("{0} must be set when MAILER=smtp")]
    Missing(&'static str),
    #[error(
        "SMTP_URL is set but MAILER is `dev`: set MAILER=smtp to send through it, \
         or unset SMTP_URL to keep mail in the log"
    )]
    SmtpUrlWithoutSmtpMailer,
    #[error("SMTP_URL is invalid: {0}")]
    InvalidSmtpUrl(&'static str),
    #[error(
        "MAIL_FROM must be an address, optionally with a display name (`CoGra <no-reply@example.org>`): {0}"
    )]
    InvalidMailFrom(String),
    #[error("SMTP_TIMEOUT_SECS must be a whole number of seconds, at least 1")]
    InvalidTimeout,
}

impl MailerConfig {
    /// The bound on one delivery when `SMTP_TIMEOUT_SECS` is unset.
    /// Provisional until the first production send is measured
    /// (production-deploy B-13).
    pub const DEFAULT_TIMEOUT_SECS: u64 = 30;

    /// The mailer the process environment names.
    pub fn from_env() -> Result<Self, MailerConfigError> {
        Self::from_lookup(|key| std::env::var(key).ok())
    }

    /// The mailer the given variables name — `from_env` over any source,
    /// so every shape is testable without touching the process
    /// environment.
    pub fn from_lookup(lookup: impl Fn(&str) -> Option<String>) -> Result<Self, MailerConfigError> {
        let mailer = lookup("MAILER");
        match mailer.as_deref().map(str::trim) {
            None | Some("dev") => {
                if lookup("SMTP_URL").is_some() {
                    return Err(MailerConfigError::SmtpUrlWithoutSmtpMailer);
                }
                Ok(Self::Dev {
                    log_file: lookup("DEV_MAILER_LOG").map(PathBuf::from),
                })
            }
            Some("smtp") => Ok(Self::Smtp(smtp_config(&lookup)?)),
            Some(other) => Err(MailerConfigError::UnknownMailer(other.to_string())),
        }
    }
}

fn smtp_config(lookup: &impl Fn(&str) -> Option<String>) -> Result<SmtpConfig, MailerConfigError> {
    let url = lookup("SMTP_URL")
        .filter(|u| !u.trim().is_empty())
        .ok_or(MailerConfigError::Missing("SMTP_URL"))?;
    let from = lookup("MAIL_FROM")
        .filter(|f| !f.trim().is_empty())
        .ok_or(MailerConfigError::Missing("MAIL_FROM"))?;
    let from: Mailbox =
        unquoted(from.trim())
            .parse()
            .map_err(|e: lettre::address::AddressError| {
                MailerConfigError::InvalidMailFrom(e.to_string())
            })?;
    let timeout_secs = match lookup("SMTP_TIMEOUT_SECS") {
        None => MailerConfig::DEFAULT_TIMEOUT_SECS,
        Some(raw) => raw
            .trim()
            .parse::<u64>()
            .ok()
            .filter(|secs| *secs > 0)
            .ok_or(MailerConfigError::InvalidTimeout)?,
    };

    let parsed =
        url::Url::parse(url.trim()).map_err(|_| MailerConfigError::InvalidSmtpUrl("not a URL"))?;
    let tls = parsed
        .query_pairs()
        .find(|(key, _)| key == "tls")
        .map(|(_, value)| value.into_owned());
    let security = match (parsed.scheme(), tls.as_deref()) {
        ("smtps", None) => SmtpSecurity::ImplicitTls,
        ("smtps", Some(_)) => {
            return Err(MailerConfigError::InvalidSmtpUrl(
                "`tls=` belongs to smtp://; smtps:// is TLS already",
            ));
        }
        ("smtp", Some("required")) => SmtpSecurity::StartTlsRequired,
        ("smtp", Some("opportunistic")) => SmtpSecurity::StartTlsOpportunistic,
        ("smtp", None) => SmtpSecurity::Plain,
        ("smtp", Some(_)) => {
            return Err(MailerConfigError::InvalidSmtpUrl(
                "`tls=` must be `required` or `opportunistic`",
            ));
        }
        _ => {
            return Err(MailerConfigError::InvalidSmtpUrl(
                "the scheme must be smtps:// or smtp://",
            ));
        }
    };
    let host = parsed
        .host_str()
        .filter(|h| !h.is_empty())
        .ok_or(MailerConfigError::InvalidSmtpUrl("it names no host"))?
        .to_string();
    let has_user = !parsed.username().is_empty();
    let has_password = parsed.password().is_some();
    if has_user != has_password {
        return Err(MailerConfigError::InvalidSmtpUrl(
            "credentials need both a user and a password",
        ));
    }
    if has_password
        && matches!(
            security,
            SmtpSecurity::Plain | SmtpSecurity::StartTlsOpportunistic
        )
    {
        return Err(MailerConfigError::InvalidSmtpUrl(
            "credentials need an encrypted link: use smtps:// or smtp://…?tls=required",
        ));
    }

    Ok(SmtpConfig {
        port: parsed.port().unwrap_or_else(|| security.default_port()),
        url: url.trim().to_string(),
        host,
        security,
        authenticated: has_password,
        from,
        timeout: Duration::from_secs(timeout_secs),
    })
}

/// The value without one pair of double quotes around the whole of it.
///
/// A display name puts a space in `MAIL_FROM`, and dotenvy refuses an
/// unquoted value with a space, so `.env` quotes it; the Makefile's
/// `include .env` then exports the quotes along with the value, and the
/// exported variable wins over dotenvy's read. No mailbox both begins and
/// ends with a double quote (it ends in the address or its closing `>`), so
/// removing the pair never changes a valid value.
fn unquoted(value: &str) -> &str {
    value
        .strip_prefix('"')
        .and_then(|v| v.strip_suffix('"'))
        .unwrap_or(value)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::*;

    const PASSWORD: &str = "pa55-w0rd-secret";

    fn config(vars: &[(&str, &str)]) -> Result<MailerConfig, MailerConfigError> {
        let vars: HashMap<String, String> = vars
            .iter()
            .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
            .collect();
        MailerConfig::from_lookup(|key| vars.get(key).cloned())
    }

    fn smtp(url: &str) -> Result<SmtpConfig, MailerConfigError> {
        match config(&[
            ("MAILER", "smtp"),
            ("SMTP_URL", url),
            ("MAIL_FROM", "CoGra <no-reply@example.org>"),
        ])? {
            MailerConfig::Smtp(smtp) => Ok(smtp),
            MailerConfig::Dev { .. } => panic!("MAILER=smtp read as the dev mailer"),
        }
    }

    fn refusal(url: &str) -> MailerConfigError {
        smtp(url).expect_err("refused")
    }

    /// An environment naming no mailer gets the dev mailer, and the dev
    /// mailer's log file rides along when set.
    ///
    /// With MAILER unset the dev mailer is chosen and DEV_MAILER_LOG is honoured.
    /// ´claim:mail:the-dev-mailer-is-the-default´
    #[test]
    fn the_dev_mailer_is_the_default() {
        assert!(matches!(
            config(&[]),
            Ok(MailerConfig::Dev { log_file: None })
        ));
        let Ok(MailerConfig::Dev { log_file }) =
            config(&[("MAILER", "dev"), ("DEV_MAILER_LOG", "tmp_dev/mailer.log")])
        else {
            panic!("MAILER=dev is the dev mailer");
        };
        assert_eq!(log_file, Some(PathBuf::from("tmp_dev/mailer.log")));
    }

    /// Every value of MAILER other than the two names is refused, the
    /// near misses included, so a typo cannot fall back to the log.
    ///
    /// An unknown MAILER value refuses to start.
    /// ´claim:mail:an-unknown-mailer-is-refused´
    #[test]
    fn an_unknown_mailer_is_refused() {
        for value in ["log", "SMTP", "", "sendmail"] {
            assert_eq!(
                config(&[("MAILER", value)]).expect_err("refused"),
                MailerConfigError::UnknownMailer(value.to_string()),
                "MAILER={value}"
            );
        }
    }

    /// MAILER=smtp refuses to start without the server or without the
    /// sender, empty values included.
    ///
    /// The SMTP mailer refuses to start without its URL or its sender.
    /// ´claim:mail:smtp-needs-its-url-and-sender´
    #[test]
    fn smtp_mailer_without_its_url_refuses_to_start() {
        let from = ("MAIL_FROM", "no-reply@example.org");
        let url = ("SMTP_URL", "smtps://user:pw@smtp.example.org");
        assert_eq!(
            config(&[("MAILER", "smtp"), from]).expect_err("refused"),
            MailerConfigError::Missing("SMTP_URL")
        );
        assert_eq!(
            config(&[("MAILER", "smtp"), ("SMTP_URL", " "), from]).expect_err("refused"),
            MailerConfigError::Missing("SMTP_URL")
        );
        assert_eq!(
            config(&[("MAILER", "smtp"), url]).expect_err("refused"),
            MailerConfigError::Missing("MAIL_FROM")
        );
        assert_eq!(
            config(&[("MAILER", "smtp"), url, ("MAIL_FROM", "")]).expect_err("refused"),
            MailerConfigError::Missing("MAIL_FROM")
        );
    }

    /// An SMTP_URL left beside the dev mailer is refused rather than
    /// ignored, because the dev mailer would log the tokens it was set up
    /// to send.
    ///
    /// SMTP_URL without MAILER=smtp refuses to start.
    /// ´claim:mail:an-smtp-url-under-the-dev-mailer-is-refused´
    #[test]
    fn an_smtp_url_under_the_dev_mailer_is_refused() {
        let url = ("SMTP_URL", "smtps://user:pw@smtp.example.org");
        assert_eq!(
            config(&[url]).expect_err("refused"),
            MailerConfigError::SmtpUrlWithoutSmtpMailer
        );
        assert_eq!(
            config(&[("MAILER", "dev"), url]).expect_err("refused"),
            MailerConfigError::SmtpUrlWithoutSmtpMailer
        );
    }

    /// Each of lettre's URL forms reads as its security and port, the
    /// scheme's default port included, and an explicit port wins.
    ///
    /// Every SMTP_URL form reads as its security mode and port.
    /// ´claim:mail:each-url-form-reads-as-its-security-and-port´
    #[test]
    fn each_url_form_reads_as_its_security_and_port() {
        let cases = [
            (
                format!("smtps://user:{PASSWORD}@smtp.example.org"),
                SmtpSecurity::ImplicitTls,
                465,
                true,
            ),
            (
                format!("smtp://user:{PASSWORD}@smtp.example.org?tls=required"),
                SmtpSecurity::StartTlsRequired,
                587,
                true,
            ),
            (
                format!("smtp://user:{PASSWORD}@smtp.example.org:2525?tls=required"),
                SmtpSecurity::StartTlsRequired,
                2525,
                true,
            ),
            (
                "smtp://relay.internal?tls=opportunistic".to_string(),
                SmtpSecurity::StartTlsOpportunistic,
                587,
                false,
            ),
            (
                "smtp://relay.internal".to_string(),
                SmtpSecurity::Plain,
                25,
                false,
            ),
            (
                "smtp://127.0.0.1:2526".to_string(),
                SmtpSecurity::Plain,
                2526,
                false,
            ),
        ];
        for (url, security, port, authenticated) in cases {
            let smtp = smtp(&url).unwrap_or_else(|e| panic!("{url}: {e}"));
            assert_eq!(smtp.security(), security, "{url}");
            assert_eq!(smtp.port(), port, "{url}");
            assert_eq!(smtp.authenticated(), authenticated, "{url}");
            assert_eq!(smtp.from().email.to_string(), "no-reply@example.org");
            assert_eq!(smtp.from().name.as_deref(), Some("CoGra"));
            assert_eq!(
                smtp.timeout(),
                Duration::from_secs(MailerConfig::DEFAULT_TIMEOUT_SECS)
            );
        }
    }

    /// A password reaches the server only over a link encrypted from the
    /// first command: plain and opportunistic links with credentials are
    /// refused, and so is half a credential.
    ///
    /// Credentials over an unencrypted link refuse to start.
    /// ´claim:mail:credentials-need-an-encrypted-link´
    #[test]
    fn credentials_over_an_unencrypted_link_are_refused() {
        let need_tls = MailerConfigError::InvalidSmtpUrl(
            "credentials need an encrypted link: use smtps:// or smtp://…?tls=required",
        );
        assert_eq!(
            refusal(&format!("smtp://user:{PASSWORD}@smtp.example.org")),
            need_tls
        );
        assert_eq!(
            refusal(&format!(
                "smtp://user:{PASSWORD}@smtp.example.org?tls=opportunistic"
            )),
            need_tls
        );
        assert_eq!(
            refusal("smtps://user@smtp.example.org"),
            MailerConfigError::InvalidSmtpUrl("credentials need both a user and a password")
        );
    }

    /// The malformed URLs are refused, each naming its rule: not a URL, a
    /// foreign scheme, no host, an unknown or misplaced tls value.
    ///
    /// A malformed SMTP_URL refuses to start and names the rule it broke.
    /// ´claim:mail:a-malformed-smtp-url-is-refused´
    #[test]
    fn a_malformed_smtp_url_is_refused() {
        let cases = [
            ("//smtp.example.org:587", "not a URL"),
            (
                "https://smtp.example.org",
                "the scheme must be smtps:// or smtp://",
            ),
            ("smtps:no-authority", "it names no host"),
            (
                "smtp://smtp.example.org?tls=always",
                "`tls=` must be `required` or `opportunistic`",
            ),
            (
                "smtps://smtp.example.org?tls=required",
                "`tls=` belongs to smtp://; smtps:// is TLS already",
            ),
        ];
        for (url, rule) in cases {
            assert_eq!(
                refusal(url),
                MailerConfigError::InvalidSmtpUrl(rule),
                "{url}"
            );
        }
    }

    /// No refusal and no debug print carries the password, whichever rule
    /// a URL with one breaks.
    ///
    /// Neither a refusal nor the config's debug form carries the SMTP password.
    /// ´claim:mail:the-smtp-password-is-never-printed´
    #[test]
    fn the_smtp_password_is_never_printed() {
        let refused = [
            format!("smtp://user:{PASSWORD}@smtp.example.org"),
            format!("smtp://user:{PASSWORD}@smtp.example.org?tls=bogus"),
            format!("ftp://user:{PASSWORD}@smtp.example.org"),
            format!("smtps://user:{PASSWORD}@"),
        ];
        for url in refused {
            let error = refusal(&url);
            assert!(!error.to_string().contains(PASSWORD), "{error}");
            assert!(!format!("{error:?}").contains(PASSWORD), "{error:?}");
        }
        let accepted =
            smtp(&format!("smtps://user:{PASSWORD}@smtp.example.org")).expect("accepted");
        let debug = format!("{accepted:?}");
        assert!(!debug.contains(PASSWORD), "{debug}");
        assert!(debug.contains("smtp.example.org"), "{debug}");
        let debug = format!("{:?}", MailerConfig::Smtp(accepted));
        assert!(!debug.contains(PASSWORD), "{debug}");
    }

    /// The sender must parse as a mailbox, and the timeout as a positive
    /// whole number of seconds.
    ///
    /// A malformed MAIL_FROM or SMTP_TIMEOUT_SECS refuses to start.
    /// ´claim:mail:a-malformed-sender-or-timeout-is-refused´
    #[test]
    fn a_malformed_sender_or_timeout_is_refused() {
        let url = ("SMTP_URL", "smtps://user:pw@smtp.example.org");
        for from in ["no-reply", "CoGra <no-reply@>", "two@at@example.org"] {
            assert!(
                matches!(
                    config(&[("MAILER", "smtp"), url, ("MAIL_FROM", from)]),
                    Err(MailerConfigError::InvalidMailFrom(_))
                ),
                "MAIL_FROM={from}"
            );
        }
        let from = ("MAIL_FROM", "no-reply@example.org");
        for timeout in ["0", "-1", "ten", "1.5", ""] {
            assert_eq!(
                config(&[
                    ("MAILER", "smtp"),
                    url,
                    from,
                    ("SMTP_TIMEOUT_SECS", timeout)
                ])
                .expect_err("refused"),
                MailerConfigError::InvalidTimeout,
                "SMTP_TIMEOUT_SECS={timeout}"
            );
        }
        let Ok(MailerConfig::Smtp(smtp)) =
            config(&[("MAILER", "smtp"), url, from, ("SMTP_TIMEOUT_SECS", "12")])
        else {
            panic!("a valid timeout is accepted");
        };
        assert_eq!(smtp.timeout(), Duration::from_secs(12));
    }

    /// A sender quoted whole, as make exports a quoted .env value, reads
    /// as the same mailbox as the unquoted one, and a quoted display name
    /// keeps its quotes' meaning.
    ///
    /// A MAIL_FROM wrapped whole in double quotes reads as the mailbox inside them.
    /// ´claim:mail:a-sender-quoted-whole-reads-as-the-mailbox-inside´
    #[test]
    fn a_sender_quoted_whole_reads_as_the_mailbox_inside() {
        let url = ("SMTP_URL", "smtps://user:pw@smtp.example.org");
        for from in [
            "\"CoGra <no-reply@example.org>\"",
            "CoGra <no-reply@example.org>",
            "\"CoGra\" <no-reply@example.org>",
        ] {
            let Ok(MailerConfig::Smtp(smtp)) =
                config(&[("MAILER", "smtp"), url, ("MAIL_FROM", from)])
            else {
                panic!("MAIL_FROM={from} is accepted");
            };
            assert_eq!(smtp.from().name.as_deref(), Some("CoGra"), "{from}");
            assert_eq!(smtp.from().email.to_string(), "no-reply@example.org");
        }
    }
}
