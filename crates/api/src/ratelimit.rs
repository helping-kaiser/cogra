//! ´mod:module:ratelimit´
//!
//! Rate limiting: the auth endpoints' per-IP and per-key fixed windows
//! plus the login backoff (auth.md "Rate limiting"), the email-change
//! mail budget, the media upload budget, and the per-account signing
//! budget spent at prepare (api-spec.md "Conventions") with the voucher's
//! admission funding budget priced beside it.
//!
//! The state is Postgres-held (`postgres_store::rate_limit`), so limits
//! survive restarts and hold across instances. Auth keys that name an
//! account use the submitted, normalized email string: an unknown email
//! consumes budget exactly like a known one, so the limiter never becomes
//! an account-existence oracle (auth.md "Password reset" — success
//! regardless of existence). The upload and signing budgets are keyed by
//! the authenticated account itself.

use std::net::IpAddr;

use anyhow::Context;
use chrono::{DateTime, Utc};
use postgres_store::{PgPool, rate_limit as store};
use uuid::Uuid;

/// The request's derived client IP, injected by the GraphQL handler
/// (lib.rs) from the CLIENT_IP_SOURCE-configured extractor.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RequestIp(pub IpAddr);

pub mod scope {
    //! ´mod:module:scope´
    //!
    //! One limited verb class: the scope string keys the state rows.
    pub const LOGIN_IP: &str = "login_ip";
    pub const LOGIN_EMAIL: &str = "login_email";
    pub const REGISTER_IP: &str = "register_ip";
    pub const REGISTER_LINK: &str = "register_link";
    pub const RESET_IP: &str = "reset_ip";
    pub const RESET_EMAIL: &str = "reset_email";
    pub const RESEND_EMAIL: &str = "resend_email";
    pub const CONFIRM_IP: &str = "confirm_ip";
    pub const EMAIL_CHANGE_REQUEST_ACCOUNT: &str = "email_change_request_account";
    pub const EMAIL_CHANGE_RESEND_ACCOUNT: &str = "email_change_resend_account";
    pub const UPLOAD_ACCOUNT: &str = "upload_account";
    pub const SIGN_POST: &str = "sign_post";
    pub const SIGN_COMMENT: &str = "sign_comment";
    pub const SIGN_EDIT: &str = "sign_edit";
    pub const SIGN_STANCE: &str = "sign_stance";
    pub const SIGN_CLAIM: &str = "sign_claim";
    pub const SIGN_APPROVAL: &str = "sign_approval";
    pub const SIGN_ANY: &str = "sign_any";
    pub const ADMISSION_FUNDING_ACCOUNT: &str = "admission_funding_account";
}

/// One fixed-window budget: at most `limit` attempts per `window_secs`.
#[derive(Debug, Clone, Copy)]
pub struct Window {
    pub limit: i32,
    pub window_secs: f64,
}

impl Window {
    /// A window no test can trip by accident.
    pub const GENEROUS: Self = Self {
        limit: i32::MAX,
        window_secs: 1.0,
    };
}

/// The family class a staged act spends its signing budget from
/// (api-spec.md "Conventions" — the signing budget). The classes follow
/// the gestures a person makes, not the census families: an edit is its
/// own class whatever it edits, and a counter-record spends from the
/// class of the record it nets.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SigningClass {
    /// A Post's genesis Publish.
    Post,
    /// A Comment's genesis Review.
    Comment,
    /// An edit record — Post, Comment, or profile.
    Edit,
    /// Opinion and Affinity acts, severance counter-records included.
    Stance,
    /// Tag and Reference acts, withdrawal counter-records and creation-batch
    /// claims included.
    Claim,
    /// An inviter's vouching Opinion on approval.
    Approval,
}

impl SigningClass {
    fn scope(self) -> &'static str {
        match self {
            Self::Post => scope::SIGN_POST,
            Self::Comment => scope::SIGN_COMMENT,
            Self::Edit => scope::SIGN_EDIT,
            Self::Stance => scope::SIGN_STANCE,
            Self::Claim => scope::SIGN_CLAIM,
            Self::Approval => scope::SIGN_APPROVAL,
        }
    }
}

/// The per-account signing budget: one window per class, plus the daily
/// backstop every staged act spends from. Thresholds are sized so no one
/// acting in earnest meets them (seam 045.1); they exist to bound a
/// runaway client, not to ration a person.
#[derive(Debug, Clone, Copy)]
pub struct SigningBudget {
    pub post: Window,
    pub comment: Window,
    pub edit: Window,
    pub stance: Window,
    pub claim: Window,
    pub approval: Window,
    /// Every staged act, whatever its class.
    pub any: Window,
    /// The voucher's admission funding budget — not a signing class: it
    /// counts community-fund outflows, spent only by approval entries
    /// whose decision claims a fresh funding row (a vouch on an
    /// already-funded applicant costs the fund nothing and spends none).
    /// Priced with the approval batch, whole, before anything is staged
    /// or burned. Per voucher, never instance-global: a global cap is one
    /// an attacker could exhaust to stall every admission.
    pub admission_funding: Window,
}

impl SigningBudget {
    /// A budget no test can trip by accident.
    pub const UNLIMITED: Self = Self {
        post: Window::GENEROUS,
        comment: Window::GENEROUS,
        edit: Window::GENEROUS,
        stance: Window::GENEROUS,
        claim: Window::GENEROUS,
        approval: Window::GENEROUS,
        any: Window::GENEROUS,
        admission_funding: Window::GENEROUS,
    };

    fn window(&self, class: SigningClass) -> Window {
        match class {
            SigningClass::Post => self.post,
            SigningClass::Comment => self.comment,
            SigningClass::Edit => self.edit,
            SigningClass::Stance => self.stance,
            SigningClass::Claim => self.claim,
            SigningClass::Approval => self.approval,
        }
    }
}

impl Default for SigningBudget {
    fn default() -> Self {
        const HOUR: f64 = 3600.0;
        const DAY: f64 = 86_400.0;
        Self {
            post: Window {
                limit: 10,
                window_secs: HOUR,
            },
            comment: Window {
                limit: 60,
                window_secs: HOUR,
            },
            edit: Window {
                limit: 30,
                window_secs: HOUR,
            },
            stance: Window {
                limit: 300,
                window_secs: HOUR,
            },
            claim: Window {
                limit: 300,
                window_secs: HOUR,
            },
            approval: Window {
                limit: 50,
                window_secs: DAY,
            },
            any: Window {
                limit: 2000,
                window_secs: DAY,
            },
            // Well above inviting at a human pace (economics.md §7.2) and
            // below `approval`, so this is the scope that binds a bulk
            // voucher.
            admission_funding: Window {
                limit: 20,
                window_secs: DAY,
            },
        }
    }
}

/// The thresholds (auth.md "Rate limiting" — the spec commits to which
/// endpoints are limited; these numbers are the implementation defaults,
/// env-tunable via RATE_LIMIT_* in main). Every value is a starting
/// point sized for a small network, not a calibrated constant.
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    /// Login attempts per IP, successes included.
    pub login_ip: Window,
    /// Consecutive login failures per email before the backoff bites.
    pub login_backoff_threshold: i32,
    /// First backoff delay, doubling per further failure.
    pub login_backoff_base_secs: f64,
    /// The backoff ceiling.
    pub login_backoff_cap_secs: f64,
    /// Application submits (register) per IP.
    pub register_ip: Window,
    /// Application submits per invite link.
    pub register_link: Window,
    /// Password-reset requests per IP.
    pub reset_ip: Window,
    /// Password-reset requests per submitted email — trips silently.
    pub reset_email: Window,
    /// Verification resends per submitted email — trips silently.
    pub resend_email: Window,
    /// Token confirmations (verifyEmail, confirmPasswordReset,
    /// confirmEmailChange) per IP.
    pub confirm_ip: Window,
    /// Email-change requests per account — the mail budget. The caller
    /// is authenticated, so it answers visibly; each request mails an
    /// address of the caller's choosing, which is the spam vector.
    pub email_change_request_account: Window,
    /// Email-change resends per account, the same budget's other verb.
    pub email_change_resend_account: Window,
    /// Wrong codes against one email-change code before it is disabled
    /// until a resend mints a fresh one (auth.md "Email change").
    pub email_change_code_tries: i32,
    /// Media uploads per account. Uploading is not an act, so θ prices
    /// nothing about it and an insolvent actor can still fill the store —
    /// this is the only cost control media has.
    pub upload_account: Window,
    /// The per-account signing budget, spent at prepare.
    pub signing: SigningBudget,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            login_ip: Window {
                limit: 30,
                window_secs: 900.0,
            },
            login_backoff_threshold: 5,
            login_backoff_base_secs: 1.0,
            login_backoff_cap_secs: 900.0,
            register_ip: Window {
                limit: 5,
                window_secs: 3600.0,
            },
            register_link: Window {
                limit: 20,
                window_secs: 86_400.0,
            },
            reset_ip: Window {
                limit: 10,
                window_secs: 3600.0,
            },
            reset_email: Window {
                limit: 3,
                window_secs: 3600.0,
            },
            resend_email: Window {
                limit: 5,
                window_secs: 3600.0,
            },
            confirm_ip: Window {
                limit: 30,
                window_secs: 900.0,
            },
            email_change_request_account: Window {
                limit: 5,
                window_secs: 3600.0,
            },
            email_change_resend_account: Window {
                limit: 5,
                window_secs: 3600.0,
            },
            email_change_code_tries: 5,
            upload_account: Window {
                limit: 60,
                window_secs: 3600.0,
            },
            signing: SigningBudget::default(),
        }
    }
}

impl RateLimitConfig {
    /// Reads the RATE_LIMIT_* overrides on top of the defaults. Only the
    /// counts are env-tunable; window and backoff shapes change in code —
    /// a deliberate knob budget, not an omission.
    pub fn from_env() -> anyhow::Result<Self> {
        let mut cfg = Self::default();
        for (var, limit) in [
            ("RATE_LIMIT_LOGIN_PER_IP", &mut cfg.login_ip.limit),
            ("RATE_LIMIT_REGISTER_PER_IP", &mut cfg.register_ip.limit),
            ("RATE_LIMIT_REGISTER_PER_LINK", &mut cfg.register_link.limit),
            ("RATE_LIMIT_RESET_PER_IP", &mut cfg.reset_ip.limit),
            ("RATE_LIMIT_RESET_PER_EMAIL", &mut cfg.reset_email.limit),
            ("RATE_LIMIT_RESEND_PER_EMAIL", &mut cfg.resend_email.limit),
            ("RATE_LIMIT_CONFIRM_PER_IP", &mut cfg.confirm_ip.limit),
            (
                "RATE_LIMIT_EMAIL_CHANGE_REQUEST_PER_ACCOUNT",
                &mut cfg.email_change_request_account.limit,
            ),
            (
                "RATE_LIMIT_EMAIL_CHANGE_RESEND_PER_ACCOUNT",
                &mut cfg.email_change_resend_account.limit,
            ),
            (
                "RATE_LIMIT_EMAIL_CHANGE_CODE_TRIES",
                &mut cfg.email_change_code_tries,
            ),
            (
                "RATE_LIMIT_UPLOAD_PER_ACCOUNT",
                &mut cfg.upload_account.limit,
            ),
            ("RATE_LIMIT_SIGN_POST", &mut cfg.signing.post.limit),
            ("RATE_LIMIT_SIGN_COMMENT", &mut cfg.signing.comment.limit),
            ("RATE_LIMIT_SIGN_EDIT", &mut cfg.signing.edit.limit),
            ("RATE_LIMIT_SIGN_STANCE", &mut cfg.signing.stance.limit),
            ("RATE_LIMIT_SIGN_CLAIM", &mut cfg.signing.claim.limit),
            ("RATE_LIMIT_SIGN_APPROVAL", &mut cfg.signing.approval.limit),
            ("RATE_LIMIT_SIGN_ANY", &mut cfg.signing.any.limit),
            (
                "RATE_LIMIT_ADMISSION_FUNDING",
                &mut cfg.signing.admission_funding.limit,
            ),
        ] {
            if let Ok(raw) = std::env::var(var) {
                *limit = raw
                    .parse()
                    .with_context(|| format!("{var} must be an integer"))?;
            }
        }
        Ok(cfg)
    }

    /// A config no test can trip by accident — for rigs exercising other
    /// surfaces. The email-change code cap keeps its default: it is a
    /// security property, not a throttle, and five wrong codes are never
    /// incidental.
    pub fn unlimited() -> Self {
        let generous = Window::GENEROUS;
        Self {
            login_ip: generous,
            login_backoff_threshold: i32::MAX,
            login_backoff_base_secs: 0.0,
            login_backoff_cap_secs: 0.0,
            register_ip: generous,
            register_link: generous,
            reset_ip: generous,
            reset_email: generous,
            resend_email: generous,
            confirm_ip: generous,
            email_change_request_account: generous,
            email_change_resend_account: generous,
            email_change_code_tries: 5,
            upload_account: generous,
            signing: SigningBudget::UNLIMITED,
        }
    }
}

/// Spends a batch's acts from the account's signing budget — each class's
/// window and the backstop — whole or not at all. Answers whether the
/// batch fit; a batch that does not fit spends nothing, so the author who
/// waits is not charged for having asked.
///
/// `acts` lists the batch's staged acts per class; a class may repeat.
pub async fn spend_signing(
    pool: &PgPool,
    budget: &SigningBudget,
    account: Uuid,
    acts: &[(SigningClass, usize)],
) -> Result<bool, sqlx::Error> {
    spend_signing_and_funding(pool, budget, account, acts, 0).await
}

/// [`spend_signing`] for an approval batch, which also spends
/// `fresh_fundings` from the voucher's admission funding budget — in the
/// same all-or-nothing charge, so a batch either fits both budgets or
/// spends neither.
pub async fn spend_signing_and_funding(
    pool: &PgPool,
    budget: &SigningBudget,
    account: Uuid,
    acts: &[(SigningClass, usize)],
    fresh_fundings: usize,
) -> Result<bool, sqlx::Error> {
    let key = account.to_string();
    let mut per_class: Vec<(SigningClass, i32)> = Vec::new();
    for &(class, n) in acts {
        let n = i32::try_from(n).unwrap_or(i32::MAX);
        match per_class.iter_mut().find(|(c, _)| *c == class) {
            Some((_, total)) => *total = total.saturating_add(n),
            None => per_class.push((class, n)),
        }
    }
    let total = per_class
        .iter()
        .fold(0i32, |sum, (_, n)| sum.saturating_add(*n));
    let fresh_fundings = i32::try_from(fresh_fundings).unwrap_or(i32::MAX);
    if total == 0 && fresh_fundings == 0 {
        return Ok(true);
    }
    let charge = |scope: &'static str, window: Window, n: i32| store::Charge {
        scope,
        key: &key,
        window_secs: window.window_secs,
        n,
        limit: window.limit,
    };
    let mut charges: Vec<store::Charge<'_>> = per_class
        .iter()
        .map(|&(class, n)| charge(class.scope(), budget.window(class), n))
        .collect();
    if total > 0 {
        charges.push(charge(scope::SIGN_ANY, budget.any, total));
    }
    if fresh_fundings > 0 {
        charges.push(charge(
            scope::ADMISSION_FUNDING_ACCOUNT,
            budget.admission_funding,
            fresh_fundings,
        ));
    }
    store::charge_all_within(pool, &charges).await
}

/// Spends one unit of an account's mail budget, answering whether it
/// fit. A refusal spends nothing — the person waits the window out, and
/// a refused request mails and records nothing, so it is not an attempt
/// worth counting the way a guessed token is.
pub async fn spend_mail_budget(
    pool: &PgPool,
    scope: &'static str,
    account: Uuid,
    window: Window,
) -> Result<bool, sqlx::Error> {
    let key = account.to_string();
    store::charge_all_within(
        pool,
        &[store::Charge {
            scope,
            key: &key,
            window_secs: window.window_secs,
            n: 1,
            limit: window.limit,
        }],
    )
    .await
}

/// Counts the attempt and answers whether it is within the window's
/// budget. Refused attempts count too, so hammering a tripped window
/// keeps it tripped.
pub async fn within(
    pool: &PgPool,
    scope: &str,
    key: &str,
    window: Window,
) -> Result<bool, sqlx::Error> {
    let count = store::count_in_window(pool, scope, key, window.window_secs).await?;
    Ok(count <= window.limit)
}

/// The login backoff's gate: Some(unblock time) while the email is
/// serving a delay.
pub async fn login_blocked(
    pool: &PgPool,
    email: &str,
) -> Result<Option<DateTime<Utc>>, sqlx::Error> {
    store::blocked_until(pool, scope::LOGIN_EMAIL, email).await
}

/// One consecutive login failure for the email; from the threshold on,
/// each failure doubles the delay.
pub async fn login_failed(
    pool: &PgPool,
    cfg: &RateLimitConfig,
    email: &str,
) -> Result<(), sqlx::Error> {
    store::record_failure(
        pool,
        scope::LOGIN_EMAIL,
        email,
        cfg.login_backoff_threshold,
        cfg.login_backoff_base_secs,
        cfg.login_backoff_cap_secs,
    )
    .await?;
    Ok(())
}

/// A successful login ends the consecutive-failure run.
pub async fn login_succeeded(pool: &PgPool, email: &str) -> Result<(), sqlx::Error> {
    store::clear(pool, scope::LOGIN_EMAIL, email).await
}

/// Throttle rows idle this long (and not blocking) are swept.
const IDLE_RETENTION_SECS: f64 = 7.0 * 86_400.0;

/// The periodic sweep of idle throttle rows — same shape as the account
/// reaper (onboarding.rs).
pub async fn gc_loop(pool: PgPool, interval_secs: u64) {
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval_secs));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        ticker.tick().await;
        match store::sweep_idle(&pool, IDLE_RETENTION_SECS).await {
            Ok(0) => {}
            Ok(n) => tracing::debug!(rows = n, "rate-limit GC swept idle rows"),
            Err(e) => tracing::warn!(error = %e, "rate-limit GC sweep failed"),
        }
    }
}
