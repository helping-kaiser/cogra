//! ´mod:module:onboarding´
//!
//! The applicant-as-account admission flow (auth.md "Account lifecycle";
//! invitations.md §4): link → registration (a real account + session) →
//! the key ceremony as a logged-in attach → the admission burn requested
//! across the seam at approval, settling asynchronously → staged
//! Registration signed on the device, its approval leg relayed once the
//! burn settles → landing flips the account to member.
//!
//! The backend orchestrates and relays; the applicant's own signatures
//! ground the actor, so nothing here can author for anyone.

use chrono::{DateTime, Duration, Utc};
use common::l1::census::Family;
use common::l1::crypto;
use common::l1::encoding::Encoder;
use common::l1::handshake::{BurnSettlement, BurnTicket};
use common::l1::identifier::NodeId;
use postgres_store::{PgPool, auth as store, staged};
use uuid::Uuid;

use crate::auth::{self, AuthConfig, IssuedSession};
use crate::l1::L1Boundary;
use crate::mailer::{Mail, Mailer};
use crate::prepare::{self, Gesture, PrepareError, Target};
use crate::ratelimit::{SigningBudget, SigningClass};
use crate::relay::RelayError;

/// A never-verified account expires this long after registration
/// (auth.md "Expiry"); past the bound it is dead — reapable, and
/// replaceable in place by a registration claiming its handle or email.
pub const UNVERIFIED_TTL_DAYS: i64 = 7;

/// The moment before which a never-verified account counts as dead.
pub(crate) fn dead_before() -> DateTime<Utc> {
    Utc::now() - Duration::days(UNVERIFIED_TTL_DAYS)
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
    WeakPassword(String),
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
    /// The write rule priced over a whole batch (D19) — the same account
    /// state, quoted as the gesture the author authored.
    #[error(
        "write rule: balance {balance} cannot carry this batch — {acts} acts at the act price {theta}"
    )]
    BatchWriteRule {
        balance: f64,
        theta: f64,
        acts: usize,
    },
    /// The account's signing budget cannot carry the gesture right now —
    /// a write-rule refusal the author waits out.
    #[error("write rule: the signing budget cannot carry this batch right now")]
    SigningBudget,
    /// An approval batch that would fund fresh addresses did not fit the
    /// voucher's budgets — the signing budget and the admission funding
    /// budget are charged as one, so either may be the one that is full.
    /// The same write-rule refusal, waited out the same way.
    #[error(
        "write rule: the signing budget or the admission funding budget cannot carry this batch right now"
    )]
    FundingBudget,
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
            PrepareError::BatchWriteRule {
                balance,
                theta,
                acts,
            } => OnboardingError::BatchWriteRule {
                balance,
                theta,
                acts,
            },
            PrepareError::SigningBudget => OnboardingError::SigningBudget,
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
///
/// The two clocks are independent (auth.md "Expiry"): the link's expiry
/// bounds registration through it, the account dies unverified on its own
/// clock, and the application row carries none. The verification mail
/// carries the link URL and the bare
/// token beside it, the universal fallback native apps accept as a paste
/// (auth.md "Link URLs").
pub async fn register(
    pool: &PgPool,
    auth_cfg: &AuthConfig,
    mailer: &dyn Mailer,
    corpus: &dyn crate::breach::BreachCorpus,
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
    auth::validate_new_password(corpus, &input.password)
        .await
        .map_err(OnboardingError::WeakPassword)?;
    let device_label = auth::checked_device_label(input.device_label.as_deref()).map_err(|m| {
        OnboardingError::BadInput {
            field: "deviceLabel",
            message: m.to_string(),
        }
    })?;
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
            body: format!(
                "Verify your email: {web_origin}/verify?token={token}\nOr paste the token in the app: {token}\n\nThe account expires in {UNVERIFIED_TTL_DAYS} days if unverified.",
                token = verification.token
            ),
        })
        .await;
    let session = auth::issue_session(pool, auth_cfg, account_id, device_label.as_deref()).await?;
    Ok(RegisteredAccount {
        session,
        expires_at: Utc::now() + Duration::days(UNVERIFIED_TTL_DAYS),
    })
}

/// Proves the account's address. On the unverified carve-out the token
/// is the pending change's link, so opening it also moves the address —
/// in one step, colliding as EmailInUse when another account took the
/// address meanwhile (auth.md "The unverified carve-out"). A carve-out
/// link whose change ended, or a link the change replaced, is just an
/// invalid token: the landing never says which.
pub async fn verify_email(pool: &PgPool, token: &str) -> Result<(), OnboardingError> {
    let hash = auth::hash_of(token);
    if let Some(change) = store::email_change_by_token(pool, &hash).await? {
        if change.requires_code || change.end().is_some() {
            return Err(OnboardingError::VerificationTokenInvalid);
        }
        store::confirm_email_change_link(pool, change.id).await?;
        return match store::apply_email_change(pool, change.id, dead_before()).await? {
            store::EmailChangeApply::Applied => Ok(()),
            store::EmailChangeApply::EmailInUse => Err(OnboardingError::EmailInUse),
            store::EmailChangeApply::NotReady | store::EmailChangeApply::Ended(_) => {
                Err(OnboardingError::VerificationTokenInvalid)
            }
        };
    }
    store::verify_account_email(pool, &hash, dead_before())
        .await?
        .map(|_| ())
        .ok_or(OnboardingError::VerificationTokenInvalid)
}

/// Deliberately silent: succeeds whether or not an account exists, so
/// the verb reveals nothing (api-spec "the two silent verbs").
///
/// While an unverified carve-out change is pending, the account's
/// verification link lives at the new address (auth.md "The unverified
/// carve-out"), so the resend rotates that link and mails the new
/// address; the replaced address gets nothing and its link stays dead.
/// The carve-out has no code side, so the code hash the store is offered
/// is never written.
pub async fn resend_verification(
    pool: &PgPool,
    mailer: &dyn Mailer,
    web_origin: &str,
    email: &str,
) -> Result<(), OnboardingError> {
    let Ok(email) = auth::normalize_email(email) else {
        return Ok(());
    };
    let Some(account_id) = store::unverified_account_by_email(pool, &email, dead_before()).await?
    else {
        return Ok(());
    };
    let fresh = auth::new_secret();
    let to = match store::pending_email_change(pool, account_id).await? {
        Some(change) if !change.requires_code => {
            let sent = store::resend_email_change(
                pool,
                account_id,
                store::EmailChangeSecrets {
                    original_code_hash: &fresh.hash,
                    new_email_token_hash: &fresh.hash,
                },
            )
            .await?;
            if !sent.link {
                return Ok(());
            }
            change.new_email
        }
        _ => {
            store::rotate_verification_token(pool, account_id, &fresh.hash).await?;
            email
        }
    };
    mailer
        .send(Mail {
            to,
            subject: "Verify your CoGra email".into(),
            body: format!(
                "Verify your email: {web_origin}/verify?token={token}\nOr paste the token in the app: {token}",
                token = fresh.token
            ),
        })
        .await;
    Ok(())
}

/// Attaches the device-minted actor identity to the viewer's account
/// (auth.md §Application step 3; the mutation doc carries the contract).
/// ActorKeyInUse guards against a duplicate Registration wedging the
/// second admission behind an unlandable record.
///
/// The ceremony's two outputs must cohere: the submitted address has
/// to be the one the submitted public key controls. Approval funds an
/// admission burn to that address, and funding one the key cannot spend
/// from would strand the admission (substrate.md §6) — which is also why
/// the key is replaceable only until the address is funded.
pub async fn attach_actor_key(
    pool: &PgPool,
    account_id: Uuid,
    actor_pubkey: Vec<u8>,
    address: String,
) -> Result<(), OnboardingError> {
    let verifying =
        crypto::verifying_key_from_bytes(&actor_pubkey).ok_or(OnboardingError::BadInput {
            field: "actorPubkey",
            message: "not a valid public key".into(),
        })?;
    if crypto::address_of(&verifying) != address {
        return Err(OnboardingError::BadInput {
            field: "realizationAddress",
            message: "address does not belong to the submitted key".into(),
        });
    }
    match store::attach_actor_key(pool, account_id, &actor_pubkey, &address).await? {
        store::AttachOutcome::Attached => Ok(()),
        store::AttachOutcome::KeyInUse => Err(OnboardingError::ActorKeyInUse),
        store::AttachOutcome::Refused => Err(OnboardingError::Forbidden),
    }
}

/// A refusal from an approval batch, and where it belongs: an entry's
/// index, or `None` when the batch as a whole is refused and no single
/// entry is at fault.
pub type ApprovalFault = (Option<usize>, OnboardingError);

/// One approval: the application plus the stance values the inviter
/// picks for it and commits.
#[derive(Debug, Clone)]
pub struct Approval {
    pub application: Uuid,
    pub p_d: f64,
    pub p_i: f64,
}

/// Approves applications: marks each approval, runs the admission
/// sequence backend-side (the funding claim and burn request + staged
/// Registration), and prepares the inviter's own Opinion records — the
/// vouch is the inviter's signature, never a server write (api-spec
/// `approveApplicants`).
///
/// Every entry is validated before any is executed, and the whole batch
/// is put to the write rule — the inviter's balance, signing budget, and
/// admission funding budget — before any of it is staged or burned (D19):
/// an inviter who cannot afford five vouches is refused five rather than
/// discovering it on the third. Failures after that pass are per-entry:
/// the approvals that already executed stand, and their repair path is
/// the applicant's own status poll.
pub async fn approve_applicants<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    cfg: &OnboardingConfig,
    budget: &SigningBudget,
    inviter: Uuid,
    approvals: &[Approval],
) -> Result<Vec<prepare::Prepared>, Vec<ApprovalFault>> {
    let mut errors = Vec::new();
    let mut applications = Vec::with_capacity(approvals.len());
    for (i, approval) in approvals.iter().enumerate() {
        match validate_approval(pool, inviter, approval).await {
            Ok(application) => applications.push(application),
            Err(e) => errors.push((Some(i), e)),
        }
    }
    if !errors.is_empty() {
        return Err(errors);
    }

    if let Err(e) = price_batch(pool, boundary, budget, inviter, &applications).await {
        return Err(vec![(None, e)]);
    }

    let mut prepared = Vec::with_capacity(approvals.len());
    for (i, (approval, application)) in approvals.iter().zip(applications).enumerate() {
        match approve_one(pool, boundary, cfg, inviter, approval, &application).await {
            Ok(opinion) => prepared.push(opinion),
            Err(e) => {
                errors.push((Some(i), e));
            }
        }
    }
    if errors.is_empty() {
        Ok(prepared)
    } else {
        Err(errors)
    }
}

/// Checks one approval is the inviter's to make and still live.
///
/// The approval queue is issuer-visible only, so someone else's queue
/// reads as an unknown application rather than a refusal — the two are
/// deliberately indistinguishable to the caller.
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
    Ok(application)
}

/// Executes one validated approval: marks it, runs the admission
/// sequence, and prepares the inviter's vouching Opinion.
///
/// Marking is the concurrency gate — a concurrent duplicate approval
/// loses on the `approved_at` guard, before any burn. The Opinion the
/// inviter then signs depends on the Registration, so it orders after
/// the anchor it vouches for (invitations.md §2) — and it is signable at
/// once, whether or not the burn has settled: the Registration's act id
/// is fixed at prepare, and it is the Registration's relay, not the
/// vouch, that waits for the funding.
async fn approve_one<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    cfg: &OnboardingConfig,
    inviter: Uuid,
    approval: &Approval,
    application: &store::Application,
) -> Result<prepare::Prepared, OnboardingError> {
    let account_id = store::approve_application(pool, application.id)
        .await?
        .ok_or(OnboardingError::BadInput {
            field: "application",
            message: "already approved".into(),
        })?;

    let approved = store::application(pool, application.id)
        .await?
        .ok_or_else(|| OnboardingError::Internal("application vanished at approval".into()))?;
    let registration =
        ensure_admission_staged(pool, boundary, cfg, &approved, Some(inviter)).await?;
    let applicant_address = actor_address(pool, account_id).await?;

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
            target: Target::Node(NodeId::Prof(applicant_address)),
            p_d: approval.p_d,
            p_i: approval.p_i,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
            deps: vec![registration.proposal.body.act_id()],
            payload: vec![],
            node: None,
        },
    )
    .await?;
    Ok(opinion)
}

/// The inviter's own vouches, put to the write rule as one gesture (D19):
/// the batch's solvency, then its signing budget and its admission
/// funding budget, charged as one.
///
/// The funding budget counts only the entries that would claim a fresh
/// funding row — an applicant whose address is already funded costs the
/// fund nothing. The count is read before the claims, so a concurrent
/// approval that funds one of these addresses first can only make it an
/// overcharge, never an outflow nobody paid budget for.
async fn price_batch<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    budget: &SigningBudget,
    inviter: Uuid,
    applications: &[store::Application],
) -> Result<(), OnboardingError> {
    let address = actor_address(pool, inviter).await?;
    prepare::check_batch_solvency(boundary, &address, applications.len()).await?;

    let mut applicants = Vec::with_capacity(applications.len());
    for application in applications {
        let applicant = actor_address(pool, application.account_id).await?;
        if !applicants.contains(&applicant) {
            applicants.push(applicant);
        }
    }
    let funded = store::funded_addresses(pool, &applicants).await?;
    let fresh = applicants.iter().filter(|a| !funded.contains(a)).count();

    let fits = crate::ratelimit::spend_signing_and_funding(
        pool,
        budget,
        inviter,
        &[(SigningClass::Approval, applications.len())],
        fresh,
    )
    .await?;
    match (fits, fresh) {
        (true, _) => Ok(()),
        (false, 0) => Err(OnboardingError::SigningBudget),
        (false, _) => Err(OnboardingError::FundingBudget),
    }
}

/// The attached address of an actor row; Internal when the actor is
/// missing or keyless — callers only reach here past the attach proof.
async fn actor_address(pool: &PgPool, actor_id: Uuid) -> Result<String, OnboardingError> {
    crate::nodes::required_address(pool, actor_id)
        .await
        .map_err(|e| OnboardingError::Internal(e.to_string()))
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

/// Idempotently brings an approved application to "staged and funded":
/// the address's admission funding (claimed, and its burn requested
/// across the seam) and the staged Registration, staged under the
/// applicant's own actor row. Also the repair path — a crash between
/// approval and staging heals on the applicant's next status poll
/// (`User.application`), which passes no `trigger`.
///
/// Reachable concurrently from every approval of the account and from
/// that poll; serialized on the **account** (`store::lock_account`), so
/// the sequence runs at most once at a time per account whichever path
/// it comes through. The transaction exists only to hold that lock — the
/// writes below it commit on their own connections — so a loser queues
/// there and then finds the winner's work: the staged admission row, and
/// the funding row.
///
/// Only the unchained Registration counts as the admission one. A profile
/// update is also `Family::Registration` but always asserts its chain
/// parent (substrate.md §9), so it must neither satisfy the
/// already-staged check nor hide the admission row behind itself.
///
/// The funding guard is the address's funding row, never the B_i read: a
/// realization that settles a burn after a delay publishes a balance that
/// reads zero while the burn is pending, so a guard on B_i would burn
/// again on every retry and poll in that window. Only the inserter of the
/// row requests the burn; a request lost to a crash or a transient
/// realization error leaves the row ticketless, and the settlement pass
/// re-requests it under the same key, so the realization burns once.
pub async fn ensure_admission_staged<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    cfg: &OnboardingConfig,
    application: &store::Application,
    trigger: Option<Uuid>,
) -> Result<prepare::Prepared, OnboardingError> {
    if application.approved_at.is_none() {
        return Err(OnboardingError::BadInput {
            field: "application",
            message: "not approved".into(),
        });
    }

    let mut lock = pool.begin().await?;
    if !store::lock_account(&mut lock, application.account_id).await? {
        return Err(OnboardingError::Internal(
            "account vanished at staging".into(),
        ));
    }

    if let Some(existing) = staged::list_for_actor(pool, application.account_id)
        .await
        .map_err(|e| OnboardingError::Internal(e.to_string()))?
        .into_iter()
        .find(|w| {
            w.proposal.body.family == Family::Registration
                && w.state != staged::StagedState::Expired
                && w.proposal.body.asserted_parents.is_empty()
        })
    {
        lock.commit().await?;
        return Ok(prepare::Prepared {
            id: existing.id,
            proposal: existing.proposal,
            gc_after_epochs: cfg.gc_after_epochs,
        });
    }

    let address = actor_address(pool, application.account_id).await?;
    if let Some(key) = store::claim_admission_funding(
        pool,
        &address,
        application.account_id,
        trigger,
        cfg.admission_burn_micro,
    )
    .await?
    {
        request_burn(pool, boundary, &address, cfg.admission_burn_micro, key).await?;
    }
    let funding = store::admission_funding(pool, &address)
        .await?
        .ok_or_else(|| OnboardingError::Internal("funding row vanished at staging".into()))?;
    if funding.failed_at.is_some() {
        return Err(OnboardingError::Internal(format!(
            "the admission funding of {address} failed on the realization; \
             no Registration is staged that could never be paid for"
        )));
    }

    let prepared = prepare::prepare_funded_admission(
        boundary,
        pool,
        cfg.gc_after_epochs,
        application.account_id,
        Gesture {
            author: address.clone(),
            family: Family::Registration,
            middle: None,
            target: Target::Node(NodeId::Prof(address)),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
            deps: vec![],
            payload: registration_payload(&application.handle),
            node: None,
        },
    )
    .await?;
    lock.commit().await?;
    Ok(prepared)
}

/// Sends one burn request under the funding's key and records it — the
/// attempt always, the ticket when the realization answered. A refused
/// request is logged, not raised: the funding row stands, and the
/// settlement pass re-requests under the same key, so an approval or a
/// poll is never refused for a realization's transient trouble and the
/// realization still burns once.
async fn request_burn<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    address: &str,
    amount_micro: i64,
    key: Uuid,
) -> Result<Option<BurnTicket>, OnboardingError> {
    match boundary
        .request_admission_burn(address, amount_micro, key)
        .await
    {
        Ok(ticket) => {
            store::record_funding_request(pool, address, Some(&ticket.0)).await?;
            Ok(Some(ticket))
        }
        Err(e) => {
            tracing::warn!(
                address,
                error = %e,
                "admission burn request failed; the settlement pass re-requests it under the same key"
            );
            store::record_funding_request(pool, address, None).await?;
            Ok(None)
        }
    }
}

/// What one settlement pass did, carried on the ingest outcome so callers
/// and tests see it rather than only the log.
#[derive(Debug, Default)]
pub struct SettlementOutcome {
    /// Addresses whose funding this pass stamped settled.
    pub settled: Vec<String>,
    /// Addresses whose funding the realization refused for good.
    pub failed: Vec<String>,
    /// Burn requests this pass (re)sent.
    pub requested: usize,
    /// Held admission Registrations whose approval leg this pass relayed.
    pub relayed: Vec<Uuid>,
    /// What went wrong on the way; every item is retried by the next pass.
    pub errors: Vec<String>,
}

impl SettlementOutcome {
    fn is_idle(&self) -> bool {
        self.settled.is_empty()
            && self.failed.is_empty()
            && self.requested == 0
            && self.relayed.is_empty()
            && self.errors.is_empty()
    }
}

/// The settlement pass (auth.md "Funding"), run by every ingestion pass:
///
/// 1. every pending funding's settlement is read across the seam and
///    stamped once the burn is pinned; a funding with no ticket — its
///    request lost to a crash or refused transiently — or whose read
///    errs is re-requested under its own key, so the realization still
///    burns once; a refusal for good is stamped failed and logged at
///    error level, and the applicant's Registration stays held;
/// 2. every held admission Registration whose funding has settled — not
///    only those this pass settled, so a hold stored just after an
///    earlier pass read its funding is never stranded — has its approval
///    leg relayed and its hold cleared.
///
/// Costs one indexed scan of pending rows and one seam call per pending
/// row: O(pending), negligible at friends-cohort scale. A pass that did
/// anything logs its wall time.
pub async fn settle_admission_fundings<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
) -> SettlementOutcome {
    let started = std::time::Instant::now();
    let mut outcome = SettlementOutcome::default();
    match store::pending_admission_fundings(pool).await {
        Ok(pending) => {
            for funding in pending {
                if let Err(e) = settle_one(boundary, pool, &funding, &mut outcome).await {
                    outcome
                        .errors
                        .push(format!("funding of {}: {e}", funding.address));
                }
            }
        }
        Err(e) => outcome.errors.push(format!("pending fundings: {e}")),
    }
    match staged::held_approvals_ready(pool).await {
        Ok(held) => {
            for hold in held {
                match crate::relay::relay_held(boundary, pool, hold.id, hold.approval_signature)
                    .await
                {
                    Ok(()) => outcome.relayed.push(hold.id),
                    Err(e) => outcome
                        .errors
                        .push(format!("held approval of staged {}: {e}", hold.id)),
                }
            }
        }
        Err(e) => outcome.errors.push(format!("held approvals: {e}")),
    }
    for error in &outcome.errors {
        tracing::error!(error = %error, "settlement pass step failed; the next pass retries it");
    }
    if !outcome.is_idle() {
        tracing::info!(
            settled = outcome.settled.len(),
            failed = outcome.failed.len(),
            requested = outcome.requested,
            relayed = outcome.relayed.len(),
            errors = outcome.errors.len(),
            elapsed_ms = started.elapsed().as_millis() as u64,
            "admission settlement pass"
        );
    }
    outcome
}

async fn settle_one<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    funding: &store::AdmissionFunding,
    outcome: &mut SettlementOutcome,
) -> Result<(), OnboardingError> {
    let rerequest = |outcome: &mut SettlementOutcome| {
        outcome.requested += 1;
        request_burn(
            pool,
            boundary,
            &funding.address,
            funding.amount_micro,
            funding.request_key,
        )
    };
    let ticket = match &funding.ticket {
        Some(ticket) => BurnTicket(ticket.clone()),
        None => match rerequest(outcome).await? {
            Some(ticket) => ticket,
            None => return Ok(()),
        },
    };
    match boundary.burn_settlement(&ticket).await {
        Ok(BurnSettlement::Settled { pinned_micro }) => {
            if pinned_micro != funding.amount_micro {
                tracing::warn!(
                    address = funding.address,
                    requested = funding.amount_micro,
                    pinned = pinned_micro,
                    "the realization pinned a different amount than was requested"
                );
            }
            if store::mark_funding_settled(pool, &funding.address).await? {
                outcome.settled.push(funding.address.clone());
            }
        }
        Ok(BurnSettlement::Pending) => {}
        Ok(BurnSettlement::Failed(reason)) => {
            if store::mark_funding_failed(pool, &funding.address).await? {
                tracing::error!(
                    address = funding.address,
                    reason,
                    "the realization refused an admission burn; the applicant's Registration stays held"
                );
                outcome.failed.push(funding.address.clone());
            }
        }
        Err(e) => {
            tracing::warn!(
                address = funding.address,
                error = %e,
                "settlement read failed; re-requesting under the same key"
            );
            rerequest(outcome).await?;
        }
    }
    Ok(())
}

/// Confirm-side landing (auth.md "Approval and landing" step 4): every
/// promoted Registration flips its account's approved application to
/// landed and the account state to member. Driven off the ingestion
/// pass; a no-op for Registrations without an approved application (the
/// genesis records on a rebuild). A failure leaves the application
/// approved — it lands on a later pass — and is returned rather than
/// swallowed, so the ingestion pass reports what did not follow.
pub async fn land_promoted(
    pool: &PgPool,
    promoted: &[staged::PromotedWrite],
) -> Vec<crate::ingest::PromotionFailure> {
    let mut failures = Vec::new();
    for write in promoted {
        if write.family != Family::Registration.as_str() {
            continue;
        }
        match store::land_account(pool, write.actor_id).await {
            Ok(true) => tracing::info!(account = %write.actor_id, "application landed"),
            Ok(false) => {}
            Err(e) => failures.push(crate::ingest::PromotionFailure {
                stage: "onboarding",
                staged: write.id,
                act_id: write.act_id.clone(),
                error: e.to_string(),
            }),
        }
    }
    failures
}

/// How long a revoked or expired refresh token is kept: long enough for
/// reuse detection to still recognise a replayed one.
const REFRESH_TOKEN_RETENTION_SECS: f64 = 30.0 * 24.0 * 60.0 * 60.0;

/// How long a consumed or expired reset link or email change is kept.
/// Nothing reads them after that; only the hash would remain.
const SINGLE_USE_RETENTION_SECS: f64 = 7.0 * 24.0 * 60.0 * 60.0;

/// The account reaper (auth.md "Reaper"): a periodic sweep deleting
/// never-verified accounts past their bound — freeing handle and email.
/// Verified accounts are never reaped.
///
/// The spent-secret sweep rides the same tick. Both collect rows that
/// have stopped answering any question, and a second interval to
/// configure would buy nothing.
pub async fn reaper_loop(pool: PgPool, interval_secs: u64) {
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval_secs));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        ticker.tick().await;
        match store::reap_unverified_accounts(&pool, dead_before()).await {
            Ok(0) => {}
            Ok(n) => tracing::info!(reaped = n, "never-verified accounts swept"),
            Err(e) => tracing::error!(error = %e, "account reaper failed"),
        }
        match store::sweep_spent_secrets(
            &pool,
            REFRESH_TOKEN_RETENTION_SECS,
            SINGLE_USE_RETENTION_SECS,
        )
        .await
        {
            Ok(swept) if swept.total() == 0 => {}
            Ok(swept) => tracing::info!(
                refresh_tokens = swept.refresh_tokens,
                password_resets = swept.password_resets,
                email_changes = swept.email_changes,
                "spent auth secrets swept"
            ),
            Err(e) => tracing::error!(error = %e, "spent-secret sweep failed"),
        }
    }
}
