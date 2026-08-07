// The applicant-as-account admission flow (auth.md "Account lifecycle";
// invitations.md §4): link → registration (a real account + session) →
// the key ceremony as a logged-in attach → funding burn at approval →
// staged Registration signed on the device → landing flips the account
// to member. The backend orchestrates and relays; the applicant's own
// signatures ground the actor — nothing here can author for anyone.

use chrono::{DateTime, Duration, Utc};
use common::l1::census::Family;
use common::l1::crypto;
use common::l1::encoding::Encoder;
use common::l1::identifier::NodeId;
use l1_standin::StandIn;
use postgres_store::{PgPool, auth as store, staged};
use uuid::Uuid;

use crate::auth::{self, AuthConfig, IssuedSession};
use crate::l1::L1Boundary;
use crate::mailer::{Mail, Mailer};
use crate::prepare::{self, Gesture, PrepareError};
use crate::relay::RelayError;

/// A never-verified account expires this long after registration
/// (auth.md "Expiry"); past the bound it is dead — reapable, and
/// replaceable in place by a registration claiming its handle or email.
const UNVERIFIED_TTL_HOURS: i64 = 24;

/// The moment before which a never-verified account counts as dead.
fn dead_before() -> DateTime<Utc> {
    Utc::now() - Duration::hours(UNVERIFIED_TTL_HOURS)
}

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
    #[error("the email already belongs to an account")]
    EmailInUse,
    #[error("{0}")]
    WeakPassword(&'static str),
    /// A `BAD_INPUT` refusal pinned to a field path.
    #[error("{message}")]
    BadInput {
        field: &'static str,
        message: String,
    },
    /// The viewer's account state does not permit the gesture — a
    /// transport-tier FORBIDDEN at the mutation layer (api-spec
    /// "Authentication").
    #[error("the account state does not permit this")]
    Forbidden,
    /// The submitted key is already bound to a different account — an
    /// address binds at most one account (auth.md §Application step 3).
    #[error("the key already belongs to another account")]
    ActorKeyInUse,
    #[error("verification token invalid or expired")]
    VerificationTokenInvalid,
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
// Registration
// ---------------------------------------------------------------------

/// The registration form (api-spec `register`): the invite capability
/// plus the login triple.
#[derive(Debug, Clone)]
pub struct RegistrationInput {
    pub invite_link: Uuid,
    pub handle: String,
    pub email: String,
    pub password: String,
    pub device_label: Option<String>,
}

/// A registered account: an ordinary session, plus when the account
/// expires unless its email is verified.
pub struct RegisteredAccount {
    pub session: IssuedSession,
    pub expires_at: DateTime<Utc>,
}

/// Registers a real account through an invite link (auth.md §Application
/// step 2): the actor row (no key yet), the credentials in the applicant
/// state, and the application row, then an ordinary session. Handle and
/// email conflicts surface here, at the form. Pure L2 — nothing touches
/// L1.
pub async fn register(
    pool: &PgPool,
    auth_cfg: &AuthConfig,
    mailer: &dyn Mailer,
    web_origin: &str,
    input: RegistrationInput,
) -> Result<RegisteredAccount, OnboardingError> {
    let handle = auth::normalize_handle(&input.handle).map_err(|m| OnboardingError::BadInput {
        field: "handle",
        message: m.to_string(),
    })?;
    let email = auth::normalize_email(&input.email).map_err(|m| OnboardingError::BadInput {
        field: "email",
        message: m.to_string(),
    })?;
    auth::check_password(&input.password).map_err(OnboardingError::WeakPassword)?;
    if !store::invite_link_usable(pool, input.invite_link).await? {
        return Err(OnboardingError::InviteUnusable);
    }
    let link = store::invite_link(pool, input.invite_link)
        .await?
        .ok_or(OnboardingError::InviteUnusable)?;

    let password_hash = auth::hash_password(&input.password)?;
    let verification = auth::new_secret();
    let account_id = Uuid::new_v4();
    let outcome = store::register_account(
        pool,
        account_id,
        Uuid::new_v4(),
        link.id,
        &handle,
        &email,
        &password_hash,
        &verification.hash,
        dead_before(),
        // The application row, not the account, is bounded by its
        // link's expiry (auth.md "Expiry").
        link.expires_at,
    )
    .await?;
    match outcome {
        store::RegisterOutcome::Created => {}
        store::RegisterOutcome::HandleTaken => return Err(OnboardingError::HandleTaken),
        store::RegisterOutcome::EmailInUse => return Err(OnboardingError::EmailInUse),
    }

    mailer
        .send(Mail {
            to: email,
            subject: "Verify your CoGra email".into(),
            // The link URL (auth.md "Link URLs") plus the bare token —
            // the universal fallback native apps accept as a paste.
            body: format!(
                "Verify your email: {web_origin}/verify?token={token}\nOr paste the token in the app: {token}\n\nThe account expires in {UNVERIFIED_TTL_HOURS} hours if unverified.",
                token = verification.token
            ),
        })
        .await;
    let session =
        auth::issue_session(pool, auth_cfg, account_id, input.device_label.as_deref()).await?;
    Ok(RegisteredAccount {
        session,
        expires_at: Utc::now() + Duration::hours(UNVERIFIED_TTL_HOURS),
    })
}

pub async fn verify_email(pool: &PgPool, token: &str) -> Result<(), OnboardingError> {
    store::verify_account_email(pool, &auth::hash_of(token), dead_before())
        .await?
        .map(|_| ())
        .ok_or(OnboardingError::VerificationTokenInvalid)
}

/// Deliberately silent: succeeds whether or not an account exists, so
/// the verb reveals nothing (api-spec "the three silent verbs").
pub async fn resend_verification(
    pool: &PgPool,
    mailer: &dyn Mailer,
    web_origin: &str,
    email: &str,
) -> Result<(), OnboardingError> {
    let Ok(email) = auth::normalize_email(email) else {
        return Ok(());
    };
    if let Some(account_id) =
        store::unverified_account_by_email(pool, &email, dead_before()).await?
    {
        let fresh = auth::new_secret();
        store::rotate_verification_token(pool, account_id, &fresh.hash).await?;
        mailer
            .send(Mail {
                to: email,
                subject: "Verify your CoGra email".into(),
                body: format!(
                    "Verify your email: {web_origin}/verify?token={token}\nOr paste the token in the app: {token}",
                    token = fresh.token
                ),
            })
            .await;
    }
    Ok(())
}

// ---------------------------------------------------------------------
// The key ceremony's server half
// ---------------------------------------------------------------------

/// Attaches the device-minted actor identity to the viewer's account
/// (auth.md §Application step 3). Replaceable while the application is
/// unapproved; Forbidden once approval has bound the address — a device
/// lost before approval costs nothing but a re-run of the ceremony.
/// An address binds at most one account: a key already bound to a
/// different account refuses with ActorKeyInUse — a duplicate
/// Registration would wedge the second admission behind an unlandable
/// record.
pub async fn attach_actor_key(
    pool: &PgPool,
    account_id: Uuid,
    actor_pubkey: Vec<u8>,
    l0_address: String,
) -> Result<(), OnboardingError> {
    // The ceremony's outputs must cohere: the L0 address is the one the
    // submitted public key controls — approval funds a burn to it, and
    // funding an address the key cannot spend from would strand the
    // admission (substrate.md §6).
    let verifying =
        crypto::verifying_key_from_bytes(&actor_pubkey).ok_or(OnboardingError::BadInput {
            field: "actorPubkey",
            message: "not a valid public key".into(),
        })?;
    if crypto::address_of(&verifying) != l0_address {
        return Err(OnboardingError::BadInput {
            field: "l0Address",
            message: "address does not belong to the submitted key".into(),
        });
    }
    match store::attach_actor_key(pool, account_id, &actor_pubkey, &l0_address).await? {
        store::AttachOutcome::Attached => Ok(()),
        store::AttachOutcome::KeyInUse => Err(OnboardingError::ActorKeyInUse),
        store::AttachOutcome::Refused => Err(OnboardingError::Forbidden),
    }
}

// ---------------------------------------------------------------------
// Re-arming an expired application
// ---------------------------------------------------------------------

/// Re-arms an expired, never-approved application with a fresh invite
/// link — a new application row for the viewer's account (auth.md
/// "Expiry"). Refused while a live application exists.
pub async fn apply_with_invite(
    pool: &PgPool,
    account_id: Uuid,
    invite_link: Uuid,
) -> Result<store::Application, OnboardingError> {
    let credentials = store::credentials_by_actor(pool, account_id)
        .await?
        .ok_or(OnboardingError::Forbidden)?;
    if credentials.account_state != store::AccountState::Applicant {
        return Err(OnboardingError::Forbidden);
    }
    if let Some(latest) = store::latest_application_for(pool, account_id).await?
        && latest.landed_at.is_none()
        && (latest.approved_at.is_some() || latest.expires_at > Utc::now())
    {
        return Err(OnboardingError::BadInput {
            field: "inviteLink",
            message: "a live application already exists".into(),
        });
    }
    if !store::invite_link_usable(pool, invite_link).await? {
        return Err(OnboardingError::InviteUnusable);
    }
    let link = store::invite_link(pool, invite_link)
        .await?
        .ok_or(OnboardingError::InviteUnusable)?;
    let id = Uuid::new_v4();
    store::create_application(pool, id, account_id, link.id, link.expires_at).await?;
    store::application(pool, id)
        .await?
        .ok_or_else(|| OnboardingError::Internal("application vanished after creation".into()))
}

// ---------------------------------------------------------------------
// Approval — the inviter's priced act
// ---------------------------------------------------------------------

/// One approval: the application plus the stance values the inviter
/// commits (pre-filled from the link, adjusted at will).
#[derive(Debug, Clone)]
pub struct Approval {
    pub application: Uuid,
    pub p_d: f64,
    pub p_i: f64,
}

/// Approves applications: marks each approval, runs the admission
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
    let mut applications = Vec::with_capacity(approvals.len());
    for (i, approval) in approvals.iter().enumerate() {
        match validate_approval(pool, inviter, approval).await {
            Ok(application) => applications.push(application),
            Err(e) => errors.push((i, e)),
        }
    }
    if !errors.is_empty() {
        return Err(errors);
    }

    let mut prepared = Vec::with_capacity(approvals.len());
    for (i, (approval, application)) in approvals.iter().zip(applications).enumerate() {
        match approve_one(
            pool,
            boundary,
            funding,
            cfg,
            inviter,
            approval,
            &application,
        )
        .await
        {
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
) -> Result<store::Application, OnboardingError> {
    if !(-1.0..=1.0).contains(&approval.p_d) || !(-1.0..=1.0).contains(&approval.p_i) {
        return Err(OnboardingError::BadInput {
            field: "pDirected",
            message: "stance parameters must lie in [-1, 1]".into(),
        });
    }
    let application = store::application(pool, approval.application)
        .await?
        .ok_or(OnboardingError::BadInput {
            field: "application",
            message: "unknown application".into(),
        })?;
    let link = store::invite_link(pool, application.invite_link_id)
        .await?
        .ok_or_else(|| OnboardingError::Internal("application without a link".into()))?;
    if link.inviter_id != inviter {
        // Someone else's queue reads as an unknown application — the
        // approval queue is issuer-visible only.
        return Err(OnboardingError::BadInput {
            field: "application",
            message: "unknown application".into(),
        });
    }
    if application.approved_at.is_some() {
        return Err(OnboardingError::BadInput {
            field: "application",
            message: "already approved".into(),
        });
    }
    if !application.email_verified {
        return Err(OnboardingError::BadInput {
            field: "application",
            message: "email not verified".into(),
        });
    }
    if !application.key_attached {
        return Err(OnboardingError::BadInput {
            field: "application",
            message: "no key attached".into(),
        });
    }
    if application.expires_at <= Utc::now() {
        return Err(OnboardingError::BadInput {
            field: "application",
            message: "application expired".into(),
        });
    }
    Ok(application)
}

async fn approve_one<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    funding: &StandIn,
    cfg: &OnboardingConfig,
    inviter: Uuid,
    approval: &Approval,
    application: &store::Application,
) -> Result<prepare::Prepared, OnboardingError> {
    // The approved_at guard is the concurrency gate: a concurrent
    // duplicate approval loses here, before any burn.
    let mut conn = pool.acquire().await?;
    let account_id = store::approve_application(&mut conn, application.id)
        .await?
        .ok_or(OnboardingError::BadInput {
            field: "application",
            message: "already approved".into(),
        })?;
    drop(conn);

    let approved = store::application(pool, application.id)
        .await?
        .ok_or_else(|| OnboardingError::Internal("application vanished at approval".into()))?;
    let registration = ensure_admission_staged(pool, boundary, funding, cfg, &approved).await?;
    let applicant_address = actor_address(pool, account_id).await?;

    // The inviter's Opinion toward the new Profile, dependent on the
    // Registration so it orders after the anchor it vouches for
    // (invitations.md §2).
    let inviter_address = actor_address(pool, inviter).await?;
    let opinion = prepare::prepare(
        boundary,
        pool,
        cfg.gc_after_epochs,
        inviter,
        Gesture {
            author: inviter_address,
            family: Family::Opinion,
            middle: None,
            target: NodeId::Prof(applicant_address),
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

/// The attached L0 address of an actor row; Internal when the actor is
/// missing or keyless — callers only reach here past the attach proof.
async fn actor_address(pool: &PgPool, actor_id: Uuid) -> Result<String, OnboardingError> {
    store::actor_identity(pool, actor_id)
        .await?
        .and_then(|identity| identity.l0_address)
        .ok_or_else(|| OnboardingError::Internal("actor without an attached address".into()))
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

/// Idempotently brings an approved application to "staged and fundable":
/// the funding burn (guarded by the fresh address's zero burn history)
/// and the staged Registration, staged under the applicant's own actor
/// row. Also the repair path — a crash between approval and staging
/// heals on the applicant's next status poll (`User.application`).
pub async fn ensure_admission_staged<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    funding: &StandIn,
    cfg: &OnboardingConfig,
    application: &store::Application,
) -> Result<prepare::Prepared, OnboardingError> {
    if application.approved_at.is_none() {
        return Err(OnboardingError::BadInput {
            field: "application",
            message: "not approved".into(),
        });
    }
    if let Some(existing) =
        staged::live_for_actor(pool, application.account_id, Family::Registration)
            .await
            .map_err(|e| OnboardingError::Internal(e.to_string()))?
    {
        return Ok(prepare::Prepared {
            id: existing.id,
            proposal: existing.proposal,
            gc_after_epochs: cfg.gc_after_epochs,
        });
    }

    let address = actor_address(pool, application.account_id).await?;
    // The applicant's address is fresh — minted at the key ceremony and
    // funded only by this flow — so a zero burn history is the funding
    // idempotency guard (no double-fund on repair).
    let balance = boundary
        .balance(&address)
        .await
        .map_err(|e| OnboardingError::Internal(e.to_string()))?;
    if balance.burned_total == 0.0 {
        funding
            .credit_burn(&address, cfg.admission_burn_micro)
            .await
            .map_err(|e| OnboardingError::Internal(e.to_string()))?;
    }

    Ok(prepare::prepare(
        boundary,
        pool,
        cfg.gc_after_epochs,
        application.account_id,
        Gesture {
            author: address.clone(),
            family: Family::Registration,
            middle: None,
            target: NodeId::Prof(address),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
            deps: vec![],
            payload: registration_payload(&application.handle),
        },
    )
    .await?)
}

// ---------------------------------------------------------------------
// Landing and the reaper
// ---------------------------------------------------------------------

/// Confirm-side landing (auth.md "Approval and landing" step 4): every
/// promoted Registration flips its account's approved application to
/// landed and the account state to member. Driven off the ingestion
/// pass; a no-op for Registrations without an approved application (the
/// genesis records on a rebuild). A failure logs and leaves the
/// application approved — it lands on a later pass or surfaces
/// operationally.
pub async fn land_promoted(pool: &PgPool, promoted: &[staged::PromotedWrite]) {
    for write in promoted {
        if write.family != Family::Registration.as_str() {
            continue;
        }
        match store::land_account(pool, write.actor_id).await {
            Ok(true) => tracing::info!(account = %write.actor_id, "application landed"),
            Ok(false) => {}
            Err(e) => {
                tracing::error!(account = %write.actor_id, error = %e, "landing failed");
            }
        }
    }
}

/// The account reaper (auth.md "Reaper"): a periodic sweep deleting
/// never-verified accounts past their bound — freeing handle and email.
/// Verified accounts are never reaped.
pub async fn reaper_loop(pool: PgPool, interval_secs: u64) {
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval_secs));
    loop {
        ticker.tick().await;
        match store::reap_unverified_accounts(&pool, dead_before()).await {
            Ok(0) => {}
            Ok(n) => tracing::info!(reaped = n, "never-verified accounts swept"),
            Err(e) => tracing::error!(error = %e, "account reaper failed"),
        }
    }
}
