// The staged-applicant admission flow (auth.md "Account lifecycle";
// invitations.md §4): link → application with the device key ceremony →
// funding burn → staged Registration signed on next open → landing. The
// backend orchestrates and relays; the applicant's own signatures ground
// the actor — nothing here can author for anyone.

use chrono::{DateTime, Duration, Utc};
use common::l1::census::Family;
use common::l1::crypto;
use common::l1::encoding::Encoder;
use common::l1::identifier::NodeId;
use l1_standin::StandIn;
use postgres_store::staged::{PreSignedParts, StagedBy, StagedWrite};
use postgres_store::{PgPool, auth as store, staged};
use uuid::Uuid;

use crate::auth::{self, AuthConfig, IssuedSession};
use crate::l1::L1Boundary;
use crate::mailer::{Mail, Mailer};
use crate::prepare::{self, Gesture, PrepareError};
use crate::relay::{self, RelayError};

/// Unverified applications expire after 24 hours (auth.md "Application").
const APPLICANT_TTL_HOURS: i64 = 24;

/// Operational knobs of the admission flow.
#[derive(Clone)]
pub struct OnboardingConfig {
    /// The community-funded admission burn per approved applicant, in
    /// micro-units (`ADMISSION_BURN_MICRO`, development.md). An
    /// operational value until the economics slice wires the subsidy
    /// machinery; sized like the genesis cast's funding by default.
    pub admission_burn_micro: i64,
    /// The staged-write GC bound the prepare legs report.
    pub gc_after_epochs: i64,
}

impl Default for OnboardingConfig {
    fn default() -> Self {
        Self {
            admission_burn_micro: 100_000_000,
            gc_after_epochs: crate::ingest::DEFAULT_GC_AFTER_EPOCHS,
        }
    }
}

/// Flow refusals, named by their api-spec `ErrorCode`.
#[derive(Debug, thiserror::Error)]
pub enum OnboardingError {
    #[error("invite link invalid, expired, revoked, or consumed")]
    InviteUnusable,
    #[error("handle already taken")]
    HandleTaken,
    #[error("{0}")]
    WeakPassword(&'static str),
    /// A `BAD_INPUT` refusal pinned to a field path.
    #[error("{message}")]
    BadInput {
        field: &'static str,
        message: String,
    },
    #[error("a live application already holds this email")]
    ApplicationInProgress,
    #[error("verification token invalid or expired")]
    VerificationTokenInvalid,
    /// The applicant token authorized nothing.
    #[error("unknown applicant token")]
    Unauthenticated,
    #[error("write rule: balance {balance} below the act price {theta}")]
    WriteRule { balance: f64, theta: f64 },
    #[error("signature invalid: {0}")]
    SignatureInvalid(String),
    #[error("staged write expired; the flow re-stages on next poll")]
    StagedWriteExpired,
    #[error(transparent)]
    Auth(#[from] auth::AuthError),
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
    #[error("internal: {0}")]
    Internal(String),
}

impl From<PrepareError> for OnboardingError {
    fn from(e: PrepareError) -> Self {
        match e {
            PrepareError::WriteRule { balance, theta } => {
                OnboardingError::WriteRule { balance, theta }
            }
            PrepareError::Formation(m) => OnboardingError::BadInput {
                field: "input",
                message: m,
            },
            other => OnboardingError::Internal(other.to_string()),
        }
    }
}

impl From<RelayError> for OnboardingError {
    fn from(e: RelayError) -> Self {
        match e {
            RelayError::SignatureInvalid(m) => OnboardingError::SignatureInvalid(m),
            RelayError::Wedged(_) => OnboardingError::StagedWriteExpired,
            other => OnboardingError::Internal(other.to_string()),
        }
    }
}

// ---------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------

/// What the application submit needs from the device: the login triple
/// plus the key ceremony's public outputs (api-spec `submitApplication`).
#[derive(Debug, Clone)]
pub struct ApplicationInput {
    pub invite_link: Uuid,
    pub handle: String,
    pub email: String,
    pub password: String,
    pub actor_pubkey: Vec<u8>,
    pub l0_address: String,
}

/// The submit's result: the applicant token that authorizes the
/// applicant's own flow, and the unverified application's expiry.
pub struct SubmittedApplication {
    pub applicant_token: String,
    pub expires_at: DateTime<Utc>,
}

pub async fn submit_application(
    pool: &PgPool,
    mailer: &dyn Mailer,
    input: ApplicationInput,
) -> Result<SubmittedApplication, OnboardingError> {
    let handle = auth::normalize_handle(&input.handle).map_err(|m| OnboardingError::BadInput {
        field: "handle",
        message: m.to_string(),
    })?;
    let email = auth::normalize_email(&input.email).map_err(|m| OnboardingError::BadInput {
        field: "email",
        message: m.to_string(),
    })?;
    auth::check_password(&input.password).map_err(OnboardingError::WeakPassword)?;

    // The key ceremony's outputs must cohere: the L0 address is the one
    // the submitted public key controls — approval funds a burn to it,
    // and funding an address the key cannot spend from would strand the
    // admission (substrate.md §6).
    let verifying =
        crypto::verifying_key_from_bytes(&input.actor_pubkey).ok_or(OnboardingError::BadInput {
            field: "actorPubkey",
            message: "not a valid public key".into(),
        })?;
    if crypto::address_of(&verifying) != input.l0_address {
        return Err(OnboardingError::BadInput {
            field: "l0Address",
            message: "address does not belong to the submitted key".into(),
        });
    }

    if !store::invite_link_usable(pool, input.invite_link).await? {
        return Err(OnboardingError::InviteUnusable);
    }
    if !store::handle_available(pool, &handle).await? {
        return Err(OnboardingError::HandleTaken);
    }
    // An email already on a landed account reads the same as a live
    // application — one message, no account enumeration.
    if store::credentials_by_email(pool, &email).await?.is_some() {
        return Err(OnboardingError::ApplicationInProgress);
    }

    let password_hash = auth::hash_password(&input.password)?;
    let verification = auth::new_secret();
    let applicant_token = auth::new_secret();
    let expires_at = Utc::now() + Duration::hours(APPLICANT_TTL_HOURS);
    let outcome = store::submit_applicant(
        pool,
        Uuid::new_v4(),
        input.invite_link,
        &handle,
        &email,
        &password_hash,
        &verification.hash,
        &applicant_token.hash,
        &input.actor_pubkey,
        &input.l0_address,
        expires_at,
    )
    .await?;
    if outcome == store::SubmitOutcome::EmailHeld {
        return Err(OnboardingError::ApplicationInProgress);
    }

    mailer
        .send(Mail {
            to: email,
            subject: "Verify your CoGra application".into(),
            body: format!(
                "Your verification token: {}\n\nThe application expires in {APPLICANT_TTL_HOURS} hours if unverified.",
                verification.token
            ),
        })
        .await;
    Ok(SubmittedApplication {
        applicant_token: applicant_token.token,
        expires_at,
    })
}

pub async fn verify_email(pool: &PgPool, token: &str) -> Result<(), OnboardingError> {
    store::verify_applicant_email(pool, &auth::hash_of(token))
        .await?
        .map(|_| ())
        .ok_or(OnboardingError::VerificationTokenInvalid)
}

/// Deliberately silent: succeeds whether or not an application exists,
/// so the verb reveals nothing (api-spec "the three silent verbs").
pub async fn resend_verification(
    pool: &PgPool,
    mailer: &dyn Mailer,
    email: &str,
) -> Result<(), OnboardingError> {
    let Ok(email) = auth::normalize_email(email) else {
        return Ok(());
    };
    if let Some(applicant) = store::unverified_applicant_by_email(pool, &email).await? {
        let fresh = auth::new_secret();
        store::rotate_verification_token(pool, applicant.id, &fresh.hash).await?;
        mailer
            .send(Mail {
                to: email,
                subject: "Verify your CoGra application".into(),
                body: format!("Your verification token: {}", fresh.token),
            })
            .await;
    }
    Ok(())
}

// ---------------------------------------------------------------------
// Approval — the inviter's priced act
// ---------------------------------------------------------------------

/// One approval: the applicant plus the stance values the inviter
/// commits (pre-filled from the link, adjusted at will).
#[derive(Debug, Clone)]
pub struct Approval {
    pub applicant: Uuid,
    pub p_d: f64,
    pub p_i: f64,
}

/// Approves staged applicants: marks each approval, runs the admission
/// sequence backend-side (funding burn + staged Registration), and
/// prepares the inviter's own Opinion records — the vouch is the
/// inviter's signature, never a server write (api-spec
/// `approveApplicants`).
pub async fn approve_applicants<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    funding: &StandIn,
    cfg: &OnboardingConfig,
    inviter: Uuid,
    approvals: &[Approval],
) -> Result<Vec<prepare::Prepared>, Vec<(usize, OnboardingError)>> {
    // Validate every entry before executing any: the mutation refuses
    // wholesale rather than half-approving a batch.
    let mut errors = Vec::new();
    let mut applicants = Vec::with_capacity(approvals.len());
    for (i, approval) in approvals.iter().enumerate() {
        match validate_approval(pool, inviter, approval).await {
            Ok(applicant) => applicants.push(applicant),
            Err(e) => errors.push((i, e)),
        }
    }
    if !errors.is_empty() {
        return Err(errors);
    }

    let mut prepared = Vec::with_capacity(approvals.len());
    for (i, (approval, applicant)) in approvals.iter().zip(applicants).enumerate() {
        match approve_one(pool, boundary, funding, cfg, inviter, approval, &applicant).await {
            Ok(opinion) => prepared.push(opinion),
            Err(e) => {
                // Execution failures after the validation pass are
                // surfaced per entry; already-executed approvals stand —
                // their repair path is the applicant's own poll.
                errors.push((i, e));
            }
        }
    }
    if errors.is_empty() {
        Ok(prepared)
    } else {
        Err(errors)
    }
}

async fn validate_approval(
    pool: &PgPool,
    inviter: Uuid,
    approval: &Approval,
) -> Result<store::Applicant, OnboardingError> {
    if !(-1.0..=1.0).contains(&approval.p_d) || !(-1.0..=1.0).contains(&approval.p_i) {
        return Err(OnboardingError::BadInput {
            field: "pDirected",
            message: "stance parameters must lie in [-1, 1]".into(),
        });
    }
    let applicant =
        store::applicant(pool, approval.applicant)
            .await?
            .ok_or(OnboardingError::BadInput {
                field: "applicant",
                message: "unknown applicant".into(),
            })?;
    let link = store::invite_link(pool, applicant.invite_link_id)
        .await?
        .ok_or_else(|| OnboardingError::Internal("applicant without a link".into()))?;
    if link.inviter_id != inviter {
        // Someone else's queue reads as an unknown applicant — the
        // approval queue is issuer-visible only.
        return Err(OnboardingError::BadInput {
            field: "applicant",
            message: "unknown applicant".into(),
        });
    }
    if applicant.approved_at.is_some() {
        return Err(OnboardingError::BadInput {
            field: "applicant",
            message: "already approved".into(),
        });
    }
    if applicant.email_verified_at.is_none() {
        return Err(OnboardingError::BadInput {
            field: "applicant",
            message: "email not verified".into(),
        });
    }
    if applicant.expires_at <= Utc::now() {
        return Err(OnboardingError::BadInput {
            field: "applicant",
            message: "application expired".into(),
        });
    }
    Ok(applicant)
}

async fn approve_one<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    funding: &StandIn,
    cfg: &OnboardingConfig,
    inviter: Uuid,
    approval: &Approval,
    applicant: &store::Applicant,
) -> Result<prepare::Prepared, OnboardingError> {
    // The approved_at guard is the concurrency gate: a concurrent
    // duplicate approval loses here, before any burn.
    let mut conn = pool.acquire().await?;
    let approved = store::approve_applicant(&mut conn, applicant.id)
        .await?
        .ok_or(OnboardingError::BadInput {
            field: "applicant",
            message: "already approved".into(),
        })?;
    drop(conn);

    let registration = ensure_admission_staged(pool, boundary, funding, cfg, &approved).await?;

    // The inviter's Opinion toward the new Profile, dependent on the
    // Registration so it orders after the anchor it vouches for
    // (invitations.md §2).
    let inviter_identity = store::actor_identity(pool, inviter)
        .await?
        .ok_or_else(|| OnboardingError::Internal("inviter without an actor row".into()))?;
    let opinion = prepare::prepare(
        boundary,
        pool,
        cfg.gc_after_epochs,
        StagedBy::Actor(inviter),
        Gesture {
            author: inviter_identity.l0_address,
            family: Family::Opinion,
            middle: None,
            target: NodeId::Prof(approved.l0_address.clone()),
            p_d: approval.p_d,
            p_i: approval.p_i,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
            deps: vec![registration.proposal.body.act_id()],
            payload: vec![],
        },
    )
    .await?;
    Ok(opinion)
}

/// The interim Registration payload until the Peer Content Envelope
/// arrives with the content slice: version + display name (= handle at
/// landing, decision D9).
fn registration_payload(handle: &str) -> Vec<u8> {
    let mut e = Encoder::new();
    e.array(2);
    e.uint(1);
    e.text(handle);
    e.finish()
}

/// Idempotently brings an approved applicant to "staged and fundable":
/// the funding burn (guarded by the fresh address's zero burn history)
/// and the staged Registration. Also the repair path — a crash between
/// approval and staging heals on the applicant's next poll.
pub async fn ensure_admission_staged<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    funding: &StandIn,
    cfg: &OnboardingConfig,
    applicant: &store::Applicant,
) -> Result<prepare::Prepared, OnboardingError> {
    if applicant.approved_at.is_none() {
        return Err(OnboardingError::BadInput {
            field: "applicant",
            message: "not approved".into(),
        });
    }
    if let Some(existing) = staged::live_for_applicant(pool, applicant.id, Family::Registration)
        .await
        .map_err(|e| OnboardingError::Internal(e.to_string()))?
    {
        return Ok(prepare::Prepared {
            id: existing.id,
            proposal: existing.proposal,
            gc_after_epochs: cfg.gc_after_epochs,
        });
    }

    // The applicant's address is fresh — minted at application time and
    // funded only by this flow — so a zero burn history is the funding
    // idempotency guard (no double-fund on repair).
    let balance = boundary
        .balance(&applicant.l0_address)
        .await
        .map_err(|e| OnboardingError::Internal(e.to_string()))?;
    if balance.burned_total == 0.0 {
        funding
            .credit_burn(&applicant.l0_address, cfg.admission_burn_micro)
            .await
            .map_err(|e| OnboardingError::Internal(e.to_string()))?;
    }

    Ok(prepare::prepare(
        boundary,
        pool,
        cfg.gc_after_epochs,
        StagedBy::Applicant(applicant.id),
        Gesture {
            author: applicant.l0_address.clone(),
            family: Family::Registration,
            middle: None,
            target: NodeId::Prof(applicant.l0_address.clone()),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
            deps: vec![],
            payload: registration_payload(&applicant.handle),
        },
    )
    .await?)
}

// ---------------------------------------------------------------------
// The applicant's own flow: status, signing, the first session
// ---------------------------------------------------------------------

pub async fn applicant_by_token(
    pool: &PgPool,
    applicant_token: &str,
) -> Result<store::Applicant, OnboardingError> {
    store::applicant_by_token_hash(pool, &auth::hash_of(applicant_token))
        .await?
        .ok_or(OnboardingError::Unauthenticated)
}

/// The staged Registration the applicant's device signs, re-staged on
/// demand when the previous staging expired (the repair path).
pub async fn staged_registration<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    funding: &StandIn,
    cfg: &OnboardingConfig,
    applicant: &store::Applicant,
) -> Result<Option<StagedWrite>, OnboardingError> {
    if applicant.approved_at.is_none() || applicant.landed_at.is_some() {
        return Ok(None);
    }
    let prepared = ensure_admission_staged(pool, boundary, funding, cfg, applicant).await?;
    Ok(Some(
        staged::load(pool, prepared.id)
            .await
            .map_err(|e| OnboardingError::Internal(e.to_string()))?,
    ))
}

/// The applicant-token twin of `submitProposals`: relays the device's
/// pre-commitment over the staged Registration.
pub async fn submit_applicant_registration<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    funding: &StandIn,
    cfg: &OnboardingConfig,
    applicant_token: &str,
    nonce: Vec<u8>,
    pre_signature: Vec<u8>,
) -> Result<StagedWrite, OnboardingError> {
    let applicant = applicant_by_token(pool, applicant_token).await?;
    let staged_write = staged_registration(pool, boundary, funding, cfg, &applicant)
        .await?
        .ok_or(OnboardingError::BadInput {
            field: "applicantToken",
            message: "no staged registration awaits a signature".into(),
        })?;
    relay::submit_pre_signed(
        boundary,
        pool,
        staged_write.id,
        PreSignedParts {
            author_pubkey: applicant.actor_pubkey.clone(),
            nonce,
            pre_signature,
        },
    )
    .await?;
    staged::load(pool, staged_write.id)
        .await
        .map_err(|e| OnboardingError::Internal(e.to_string()))
}

/// The applicant-token twin of `approveActs`: relays the approval
/// witness; landing stays asynchronous through the mirror.
pub async fn approve_applicant_registration<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    applicant_token: &str,
    approval_signature: Vec<u8>,
) -> Result<StagedWrite, OnboardingError> {
    let applicant = applicant_by_token(pool, applicant_token).await?;
    let staged_write = staged::live_for_applicant(pool, applicant.id, Family::Registration)
        .await
        .map_err(|e| OnboardingError::Internal(e.to_string()))?
        .ok_or(OnboardingError::BadInput {
            field: "applicantToken",
            message: "no staged registration awaits approval".into(),
        })?;
    relay::submit_approval(boundary, pool, staged_write.id, approval_signature).await?;
    staged::load(pool, staged_write.id)
        .await
        .map_err(|e| OnboardingError::Internal(e.to_string()))
}

/// Mints a session for a landed applicant (decision D3 — the explicit
/// mutation replacing the one-shot query field). Callable repeatedly
/// while the applicant token is valid: the token is the secret.
pub async fn claim_landed_session(
    pool: &PgPool,
    auth_cfg: &AuthConfig,
    applicant_token: &str,
    device_label: Option<&str>,
) -> Result<IssuedSession, OnboardingError> {
    let applicant = applicant_by_token(pool, applicant_token).await?;
    if applicant.landed_at.is_none() {
        return Err(OnboardingError::BadInput {
            field: "applicantToken",
            message: "the application has not landed yet".into(),
        });
    }
    let credentials = store::credentials_by_email(pool, &applicant.email)
        .await?
        .ok_or_else(|| OnboardingError::Internal("landed applicant without credentials".into()))?;
    Ok(auth::issue_session(pool, auth_cfg, credentials.actor_id, device_label).await?)
}

// ---------------------------------------------------------------------
// Landing and the reaper
// ---------------------------------------------------------------------

/// Confirm-side landing (auth.md "Approval and landing" step 4): every
/// promoted applicant-staged Registration creates the actor and
/// credentials rows and marks the applicant landed. Driven off the
/// ingestion pass; a failure logs and leaves the applicant approved —
/// the row lands on a later pass or surfaces operationally.
pub async fn land_promoted(pool: &PgPool, promoted: &[staged::PromotedWrite]) {
    for write in promoted {
        let StagedBy::Applicant(applicant_id) = write.staged_by else {
            continue;
        };
        if write.family != Family::Registration.as_str() {
            continue;
        }
        let result = async {
            let mut tx = pool.begin().await?;
            store::land_applicant(&mut tx, applicant_id, Uuid::new_v4()).await?;
            tx.commit().await
        }
        .await;
        match result {
            Ok(()) => tracing::info!(applicant = %applicant_id, "applicant landed"),
            Err(e) => {
                tracing::error!(applicant = %applicant_id, error = %e, "landing failed");
            }
        }
    }
}

/// The applicant reaper (auth.md "Account lifecycle"): a periodic sweep
/// of expired, never-approved applications.
pub async fn reaper_loop(pool: PgPool, interval_secs: u64) {
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval_secs));
    loop {
        ticker.tick().await;
        match store::reap_applicants(&pool).await {
            Ok(0) => {}
            Ok(n) => tracing::info!(reaped = n, "expired applications swept"),
            Err(e) => tracing::error!(error = %e, "applicant reaper failed"),
        }
    }
}
