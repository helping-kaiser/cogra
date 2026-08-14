//! The slice-1 mutation surface (api-spec.md "Auth and accounts", "The
//! write flow"): registration and the session-authorized admission
//! steps, sessions and credentials, invite links, and the generic
//! write-path relay legs. Conventions: one `input` argument, a dedicated
//! payload, `userErrors` empty exactly on success — except the three
//! deliberately-silent verbs, which carry no `userErrors` at all.
//! Acting mutations require the MEMBER account state — a `FORBIDDEN`
//! transport fault otherwise, never a userError (api-spec
//! "Authentication").

use std::sync::Arc;

use async_graphql::{Context, InputObject, Object, SimpleObject};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use chrono::{DateTime, Duration, Utc};
use common::l1::{crypto, key_backup, wire};
use l1_standin::StandIn;
use postgres_store::auth::RevokedReason;
use postgres_store::staged::PreSignedParts;
use postgres_store::{PgPool, auth as store, staged};
use rand::RngCore;
use rand::rngs::OsRng;
use uuid::Uuid;

use super::types::{
    Application, AuthSession, Dimension, ErrorCode, InviteLink, PreparedWrite, Session,
    StagedWriteType, User, UserError,
};
use crate::auth::{self, AuthConfig, RefreshError, Viewer};
use crate::breach::BreachCorpus;
use crate::l1::StandInBoundary;
use crate::mailer::{Mail, Mailer, WebOrigin};
use crate::onboarding::{self, OnboardingConfig, OnboardingError};
use crate::ratelimit::{self, RateLimitConfig, RequestIp, Window, scope};
use crate::relay::{self, RelayError};
use crate::stance::{self, StanceError};

/// Email-change proofs stay live this long (auth.md "Email change" —
/// single-use, short-lived; long enough to open a mailbox on another
/// device).
const EMAIL_CHANGE_TTL_HOURS: i64 = 1;
/// Password-reset tokens stay live this long (auth.md default).
const PASSWORD_RESET_TTL_MINUTES: i64 = 15;
/// Key-backup blob cap (auth.md "Blob format (v1)"): the v1 container is
/// tens of bytes, so 4 KiB leaves format headroom while denying a
/// hostile client unbounded rows.
const MAX_KEY_BACKUP_BYTES: usize = 4096;
/// An upload challenge stays live this long (auth.md "Key recovery") —
/// one signing round trip on the device, not a window worth parking in.
const KEY_BACKUP_CHALLENGE_TTL_MINUTES: i64 = 5;

/// The transport-tier refusal for a request that needed a session.
fn unauthenticated() -> async_graphql::Error {
    use async_graphql::ErrorExtensions;
    async_graphql::Error::new("authentication required").extend_with(
        |_, e: &mut async_graphql::ErrorExtensionValues| {
            e.set("code", "UNAUTHENTICATED");
        },
    )
}

fn viewer(ctx: &Context<'_>) -> async_graphql::Result<Viewer> {
    ctx.data::<Option<Viewer>>()?
        .as_ref()
        .copied()
        .ok_or_else(unauthenticated)
}

/// The transport-tier refusal for a throttled auth attempt (auth.md
/// "Rate limiting"). RATE_LIMITED rides the `errors` array, never the
/// payload — which also keeps the silent verbs' payloads shapeless.
fn rate_limited() -> async_graphql::Error {
    use async_graphql::ErrorExtensions;
    async_graphql::Error::new("rate limited; retry later").extend_with(
        |_, e: &mut async_graphql::ErrorExtensionValues| {
            e.set("code", "RATE_LIMITED");
        },
    )
}

/// Counts the attempt against a per-IP or per-key window and refuses
/// over budget. Storage faults propagate — a broken limiter store must
/// not silently disable the limits.
async fn guard_window(
    ctx: &Context<'_>,
    scope: &str,
    key: &str,
    window: Window,
) -> async_graphql::Result<()> {
    let pool = ctx.data::<PgPool>()?;
    if !ratelimit::within(pool, scope, key, window).await? {
        return Err(rate_limited());
    }
    Ok(())
}

/// The account's attached actor public key — None between registration
/// and the key ceremony's attach (auth.md §Application).
async fn actor_pubkey(pool: &PgPool, user_id: Uuid) -> async_graphql::Result<Option<Vec<u8>>> {
    Ok(store::actor_identity(pool, user_id)
        .await?
        .and_then(|identity| identity.actor_pubkey))
}

/// The request's derived client IP as a limiter key.
fn request_ip(ctx: &Context<'_>) -> async_graphql::Result<String> {
    Ok(ctx.data::<RequestIp>()?.0.to_string())
}

/// The transport-tier refusal for an acting request from a non-member
/// account — a client bug, never a state to render (api-spec
/// "Authentication").
fn forbidden() -> async_graphql::Error {
    use async_graphql::ErrorExtensions;
    async_graphql::Error::new("member account required").extend_with(
        |_, e: &mut async_graphql::ErrorExtensionValues| {
            e.set("code", "FORBIDDEN");
        },
    )
}

/// The member gate on acting mutations: the account state is read live
/// at the action site, never from a token claim (auth.md "Account
/// states").
async fn member_viewer(ctx: &Context<'_>) -> async_graphql::Result<Viewer> {
    let v = viewer(ctx)?;
    let pool = ctx.data::<PgPool>()?;
    let credentials = store::credentials_by_actor(pool, v.user_id)
        .await?
        .ok_or_else(unauthenticated)?;
    if credentials.account_state != store::AccountState::Member {
        return Err(forbidden());
    }
    Ok(v)
}

fn internal(e: impl std::fmt::Display) -> UserError {
    tracing::error!(error = %e, "mutation internal fault");
    UserError::new(ErrorCode::Internal, "internal error")
}

fn decode_b64(field: &'static str, value: &str) -> Result<Vec<u8>, UserError> {
    B64.decode(value).map_err(|_| {
        UserError::at(
            ErrorCode::BadInput,
            "not valid base64",
            vec![field.to_string()],
        )
    })
}

fn relay_error(e: RelayError, index: usize) -> UserError {
    let path = vec!["proposals".to_string(), index.to_string()];
    match e {
        RelayError::SignatureInvalid(m) => UserError::at(ErrorCode::SignatureInvalid, m, path),
        RelayError::Wedged(_) => UserError::at(
            ErrorCode::StagedWriteExpired,
            "the staged write lost its seal; re-prepare",
            path,
        ),
        RelayError::ReplayMismatch(_) => UserError::at(
            ErrorCode::BadInput,
            "resubmission does not match the sealed pre-commitment",
            path,
        ),
        RelayError::Staged(staged::StagedError::NotFound(_)) => {
            UserError::at(ErrorCode::NotFound, "unknown staged write", path)
        }
        RelayError::Staged(staged::StagedError::WrongState { actual, .. }) => UserError::at(
            ErrorCode::BadInput,
            format!("staged write is {actual}"),
            path,
        ),
        other => internal(other),
    }
}

// ---------------------------------------------------------------------
// Inputs and payloads
// ---------------------------------------------------------------------

/// Register through an invite link (auth.md §Application step 2): the
/// invite capability plus the login triple. Creates a real account in
/// the applicant state and returns an ordinary session — there is no
/// applicant token, no parallel auth surface. Pure L2: nothing touches
/// L1.
#[derive(InputObject)]
struct RegisterInput {
    invite_link: Uuid,
    handle: String,
    email: String,
    password: String,
    device_label: Option<String>,
}

/// On refusal, `userErrors` carries one of INVITE_UNUSABLE,
/// HANDLE_TAKEN, EMAIL_IN_USE, or WEAK_PASSWORD — all surfaced at the
/// form, before any later step.
#[derive(SimpleObject)]
struct RegisterPayload {
    auth: Option<AuthSession>,
    /// When the account expires unless its email is verified (24 h,
    /// auth.md "Expiry").
    expires_at: Option<DateTime<Utc>>,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct VerifyEmailInput {
    verification_token: String,
}

#[derive(SimpleObject)]
struct VerifyEmailPayload {
    /// False with a VERIFICATION_TOKEN_INVALID userError when the token
    /// is invalid or the account expired.
    ok: bool,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct ResendVerificationEmailInput {
    email: String,
}

/// Always succeeds, to avoid revealing whether an application exists —
/// one of the three deliberately-silent verbs, so no `userErrors`.
#[derive(SimpleObject)]
struct ResendVerificationEmailPayload {
    ok: bool,
}

/// Attach the device-minted actor identity to the viewer's account — the
/// key ceremony's server half (auth.md §Application step 3). Replaceable
/// while the viewer's application is unapproved; FORBIDDEN once approval
/// has bound the address.
#[derive(InputObject)]
struct AttachActorKeyInput {
    /// The device-generated actor public key (base64) — the key never
    /// leaves the device; this is its public half.
    actor_pubkey: String,
    /// The device-generated L0 address — the address approval funds.
    l0_address: String,
}

#[derive(SimpleObject)]
struct AttachActorKeyPayload {
    user: Option<User>,
    user_errors: Vec<UserError>,
}

/// Re-arm an expired, never-approved application with a fresh invite
/// link — a new application row for the viewer's account (auth.md
/// "Expiry"). BAD_INPUT while a live application exists;
/// INVITE_UNUSABLE for a dead link.
#[derive(InputObject)]
struct ApplyWithInviteInput {
    invite_link: Uuid,
}

#[derive(SimpleObject)]
struct ApplyWithInvitePayload {
    application: Option<Application>,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct ApplicationApprovalInput {
    application: Uuid,
    /// The inviter's stance toward the joiner — pre-filled from the
    /// link, committed here.
    p_directed: Dimension,
    p_interest: Dimension,
}

#[derive(InputObject)]
struct ApproveApplicantsInput {
    approvals: Vec<ApplicationApprovalInput>,
}

/// Staged proposals to pre-sign, in relay order. Each is its own priced
/// act running its own two-signature handshake; null when `userErrors`
/// is non-empty.
#[derive(SimpleObject)]
struct PreparePayload {
    writes: Option<Vec<PreparedWrite>>,
    user_errors: Vec<UserError>,
}

/// License qualifiers, mandatory at authoring time and immutable
/// (platform-guidelines.md §5): they ride the structural record as
/// public protocol references, surviving every payload state.
#[derive(InputObject)]
struct LicenseInput {
    /// Credit requirement: the creator is credited on every display,
    /// quote, and reference surface.
    attribution_required: bool,
    oversight: super::types::OversightLevel,
}

impl LicenseInput {
    fn to_content(&self) -> crate::content::License {
        crate::content::License {
            attribution: self.attribution_required,
            oversight: self.oversight.to_content(),
        }
    }
}

/// A new Post: one genesis Publish whose envelope carries the display
/// fields (post.md §1). Fields are raw scalars; moderation is
/// server-assigned.
#[derive(InputObject)]
struct PreparePostInput {
    title: Option<String>,
    description: Option<String>,
    content: String,
    license: LicenseInput,
    /// The author's attachment; defaults to the low-defaults policy
    /// value (+0.1). `pInterest` is census-fixed at 1 for Publish.
    p_directed: Option<Dimension>,
}

/// A Post edit: omitted fields are untouched (newest-wins fold per
/// field, post.md §4); an explicit null clears the field. Identity,
/// creator, and license never edit.
#[derive(InputObject)]
struct PreparePostEditInput {
    id: Uuid,
    title: async_graphql::MaybeUndefined<String>,
    description: async_graphql::MaybeUndefined<String>,
    content: async_graphql::MaybeUndefined<String>,
}

/// A new Comment: one genesis Review — A leg to the target, terminal
/// leg minting the Comment (comment.md §1). This slice offers the
/// comment box on Posts and Comments.
#[derive(InputObject)]
struct PrepareCommentInput {
    target: Uuid,
    content: String,
    license: LicenseInput,
    /// Enthusiasm and effort; each defaults to +0.1 (invitations.md §3).
    p_directed: Option<Dimension>,
    p_interest: Option<Dimension>,
}

/// A Comment edit: an omitted body is refused (nothing would change);
/// an explicit null clears to empty.
#[derive(InputObject)]
struct PrepareCommentEditInput {
    id: Uuid,
    content: async_graphql::MaybeUndefined<String>,
}

/// A prepared content write: the staged handshake plus `node` — the L2
/// id the envelope binds to the minted node, and the id the content
/// reads serve once the record lands. Null when `userErrors` is
/// non-empty.
#[derive(SimpleObject)]
struct PrepareContentPayload {
    node: Option<Uuid>,
    writes: Option<Vec<PreparedWrite>>,
    user_errors: Vec<UserError>,
}

impl PrepareContentPayload {
    fn ok(prepared: crate::content::PreparedContent) -> Self {
        Self {
            node: Some(prepared.node),
            writes: Some(vec![PreparedWrite::from_prepared(prepared.prepared)]),
            user_errors: vec![],
        }
    }

    fn refused(errors: Vec<UserError>) -> Self {
        Self {
            node: None,
            writes: None,
            user_errors: errors,
        }
    }

    fn from_error(e: crate::content::ContentError) -> Self {
        use crate::content::ContentError;
        Self::refused(vec![match e {
            ContentError::BadInput { field, message } => {
                UserError::at(ErrorCode::BadInput, message, vec![field.to_string()])
            }
            ContentError::NotFound => UserError::new(ErrorCode::NotFound, "content not found"),
            ContentError::NotCreator => UserError::new(
                ErrorCode::Forbidden,
                "only the creator's edits win the fold",
            ),
            ContentError::Prepare(e) => UserError::from_onboarding(&OnboardingError::from(e), ""),
            e @ ContentError::Internal(_) => internal(e),
        }])
    }
}

/// An edit field from the wire: undefined = untouched, null = cleared,
/// a value = replaced (post.md §4 — empty is a value).
fn edit_field(v: async_graphql::MaybeUndefined<String>) -> Option<String> {
    match v {
        async_graphql::MaybeUndefined::Undefined => None,
        async_graphql::MaybeUndefined::Null => Some(String::new()),
        async_graphql::MaybeUndefined::Value(s) => Some(s),
    }
}

#[derive(InputObject)]
struct LogInInput {
    email: String,
    password: String,
    device_label: Option<String>,
}

#[derive(SimpleObject)]
struct LogInPayload {
    /// Null with an INVALID_CREDENTIALS userError when the email /
    /// password pair did not match.
    auth: Option<AuthSession>,
    /// The pending refresh-token-reuse security event (auth.md "Reuse
    /// detection"), delivered exactly once: set to the detection time
    /// on the first successful login after a reuse-detected revocation,
    /// null otherwise and on every refusal.
    reuse_detected_at: Option<DateTime<Utc>>,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct RefreshSessionInput {
    refresh_token: String,
}

#[derive(SimpleObject)]
struct RefreshPayload {
    /// A rotated session; null with a REFRESH_TOKEN_INVALID userError
    /// when the token is invalid, expired, or revoked. A just-rotated
    /// token's replay inside the grace window returns the same
    /// successor; outside it, reuse detection revokes every session.
    auth: Option<AuthSession>,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct RevokeSessionInput {
    /// The session to revoke; the current one if omitted.
    session: Option<Uuid>,
}

#[derive(SimpleObject)]
struct RevokeSessionPayload {
    /// The revoked session, in its terminal state.
    session: Option<Session>,
    user_errors: Vec<UserError>,
}

#[derive(SimpleObject)]
struct RevokeSessionsPayload {
    revoked_count: Option<i32>,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct RequestPasswordResetInput {
    email: String,
}

/// Always succeeds, to avoid revealing whether an account exists — a
/// silent verb, no `userErrors`.
#[derive(SimpleObject)]
struct RequestPasswordResetPayload {
    ok: bool,
}

#[derive(InputObject)]
struct ConfirmPasswordResetInput {
    reset_token: String,
    new_password: String,
}

#[derive(SimpleObject)]
struct ConfirmPasswordResetPayload {
    ok: Option<bool>,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct ChangePasswordInput {
    current_password: String,
    new_password: String,
}

#[derive(SimpleObject)]
struct ChangePasswordPayload {
    ok: Option<bool>,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct RequestEmailChangeInput {
    new_email: String,
    current_password: String,
}

/// Always succeeds for a well-formed request, to avoid revealing whether
/// the new address is already registered — a silent verb, no
/// `userErrors`.
#[derive(SimpleObject)]
struct RequestEmailChangePayload {
    ok: bool,
}

#[derive(InputObject)]
struct ConfirmEmailChangeInput {
    /// Either side's proof: the code mailed to the current (original)
    /// address, or the token from the new address's verification link.
    /// The change applies only once both sides have been confirmed.
    code: String,
}

#[derive(SimpleObject)]
struct ConfirmEmailChangePayload {
    user: Option<User>,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct ChangeHandleInput {
    handle: String,
}

#[derive(SimpleObject)]
struct ChangeHandlePayload {
    user: Option<User>,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct UploadKeyBackupInput {
    /// The client-encrypted key-backup blob (base64) — ciphertext under
    /// the device-generated recovery code; the server stores what it
    /// cannot decrypt.
    blob: String,
    /// The challenge this upload spends (base64), from
    /// `createKeyBackupChallenge`.
    challenge: String,
    /// The actor key's signature (base64) over the challenge bound to
    /// these exact blob bytes.
    signature: String,
}

#[derive(SimpleObject)]
struct UploadKeyBackupPayload {
    ok: Option<bool>,
    user_errors: Vec<UserError>,
}

#[derive(SimpleObject)]
struct KeyBackupChallengePayload {
    /// The challenge to sign (base64); null with a refusal.
    challenge: Option<String>,
    expires_at: Option<DateTime<Utc>>,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct CreateInviteLinkInput {
    expires_at: DateTime<Utc>,
    prefill_p_directed: Dimension,
    prefill_p_interest: Dimension,
    /// Defaults to multi-use.
    single_use: Option<bool>,
}

#[derive(SimpleObject)]
struct CreateInviteLinkPayload {
    /// Its id is the shareable capability.
    invite_link: Option<InviteLink>,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct RevokeInviteLinkInput {
    invite_link: Uuid,
}

#[derive(SimpleObject)]
struct RevokeInviteLinkPayload {
    invite_link: Option<InviteLink>,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct PrepareStanceInput {
    /// The target actor; toward a Profile this is the reciprocation
    /// gesture completing the CoGra-join mutual pair.
    target: Uuid,
    /// The intended net state of the author's bundle — (0,0) is
    /// severance.
    p_directed: Dimension,
    p_interest: Dimension,
}

#[derive(InputObject)]
struct ProposalSignatureInput {
    staged_write_id: Uuid,
    /// The pre-commitment blob (base64): the device's private nonce and
    /// pre-commitment signature — produced with the actor's device-held
    /// key; opaque to this API.
    signature: String,
}

#[derive(InputObject)]
struct SubmitProposalsInput {
    proposals: Vec<ProposalSignatureInput>,
}

#[derive(SimpleObject)]
struct SubmitProposalsPayload {
    /// Already AWAITING_APPROVAL with the verified act included when the
    /// seal returned synchronously; otherwise observe via `stagedWrite`.
    staged_writes: Option<Vec<StagedWriteType>>,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct ApprovalSignatureInput {
    staged_write_id: Uuid,
    /// The approval-witness signature over the exact verified act,
    /// host-added commitments included (base64).
    signature: String,
}

#[derive(InputObject)]
struct ApproveActsInput {
    approvals: Vec<ApprovalSignatureInput>,
}

#[derive(SimpleObject)]
struct ApproveActsPayload {
    /// Landing stays asynchronous; observe via `stagedWrite`.
    staged_writes: Option<Vec<StagedWriteType>>,
    user_errors: Vec<UserError>,
}

// ---------------------------------------------------------------------
// The root
// ---------------------------------------------------------------------

/// The mutation root.
pub struct Mutation;

#[Object]
impl Mutation {
    /// Register through an invite link: creates the account — the actor
    /// row (no key yet) and its credentials, in the applicant state —
    /// records the application against the link, sends the verification
    /// email, and returns an ordinary session.
    async fn register(
        &self,
        ctx: &Context<'_>,
        input: RegisterInput,
    ) -> async_graphql::Result<RegisterPayload> {
        let pool = ctx.data::<PgPool>()?;
        let auth_cfg = ctx.data::<AuthConfig>()?;
        let mailer = ctx.data::<Arc<dyn Mailer>>()?;
        let web_origin = ctx.data::<WebOrigin>()?;
        let limits = ctx.data::<RateLimitConfig>()?;
        let corpus = ctx.data::<Arc<dyn BreachCorpus>>()?;
        // auth.md "Rate limiting".
        guard_window(
            ctx,
            scope::REGISTER_IP,
            &request_ip(ctx)?,
            limits.register_ip,
        )
        .await?;
        guard_window(
            ctx,
            scope::REGISTER_LINK,
            &input.invite_link.to_string(),
            limits.register_link,
        )
        .await?;
        match onboarding::register(
            pool,
            auth_cfg,
            mailer.as_ref(),
            corpus.as_ref(),
            &web_origin.0,
            onboarding::RegistrationInput {
                invite_link: input.invite_link,
                handle: input.handle,
                email: input.email,
                password: input.password,
                device_label: input.device_label,
            },
        )
        .await
        {
            Ok(registered) => Ok(RegisterPayload {
                auth: Some(AuthSession::from_issued(registered.session)),
                expires_at: Some(registered.expires_at),
                user_errors: vec![],
            }),
            Err(e) => Ok(RegisterPayload {
                auth: None,
                expires_at: None,
                user_errors: vec![UserError::from_onboarding(&e, "")],
            }),
        }
    }

    /// Proves the login channel. `ok` is false with a
    /// VERIFICATION_TOKEN_INVALID userError when the token is invalid or
    /// the account expired.
    async fn verify_email(
        &self,
        ctx: &Context<'_>,
        input: VerifyEmailInput,
    ) -> async_graphql::Result<VerifyEmailPayload> {
        let pool = ctx.data::<PgPool>()?;
        let limits = ctx.data::<RateLimitConfig>()?;
        guard_window(ctx, scope::CONFIRM_IP, &request_ip(ctx)?, limits.confirm_ip).await?;
        match onboarding::verify_email(pool, &input.verification_token).await {
            Ok(()) => Ok(VerifyEmailPayload {
                ok: true,
                user_errors: vec![],
            }),
            Err(e) => Ok(VerifyEmailPayload {
                ok: false,
                user_errors: vec![UserError::from_onboarding(&e, "")],
            }),
        }
    }

    /// Attaches the device-minted actor identity to the viewer's account
    /// — the key ceremony's server half. Replaceable while the viewer's
    /// application is unapproved; FORBIDDEN once approval has bound the
    /// address. An address binds at most one account: a key already
    /// bound to a different account refuses with an ACTOR_KEY_IN_USE
    /// userError.
    async fn attach_actor_key(
        &self,
        ctx: &Context<'_>,
        input: AttachActorKeyInput,
    ) -> async_graphql::Result<AttachActorKeyPayload> {
        let v = viewer(ctx)?;
        let pool = ctx.data::<PgPool>()?;
        let actor_pubkey = match decode_b64("actorPubkey", &input.actor_pubkey) {
            Ok(b) => b,
            Err(e) => {
                return Ok(AttachActorKeyPayload {
                    user: None,
                    user_errors: vec![e],
                });
            }
        };
        match onboarding::attach_actor_key(pool, v.user_id, actor_pubkey, input.l0_address).await {
            Ok(()) => Ok(AttachActorKeyPayload {
                user: store::actor_identity(pool, v.user_id)
                    .await?
                    .map(|identity| User::from_viewer(identity, v)),
                user_errors: vec![],
            }),
            Err(OnboardingError::Forbidden) => Err(forbidden()),
            Err(e) => Ok(AttachActorKeyPayload {
                user: None,
                user_errors: vec![UserError::from_onboarding(&e, "")],
            }),
        }
    }

    /// Re-arms an expired, never-approved application with a fresh
    /// invite link — a new application row for the viewer's account.
    async fn apply_with_invite(
        &self,
        ctx: &Context<'_>,
        input: ApplyWithInviteInput,
    ) -> async_graphql::Result<ApplyWithInvitePayload> {
        let v = viewer(ctx)?;
        let pool = ctx.data::<PgPool>()?;
        let limits = ctx.data::<RateLimitConfig>()?;
        // A re-arm is an application submit: the same budgets as register
        // (auth.md "Rate limiting").
        guard_window(
            ctx,
            scope::REGISTER_IP,
            &request_ip(ctx)?,
            limits.register_ip,
        )
        .await?;
        guard_window(
            ctx,
            scope::REGISTER_LINK,
            &input.invite_link.to_string(),
            limits.register_link,
        )
        .await?;
        match onboarding::apply_with_invite(pool, v.user_id, input.invite_link).await {
            Ok(application) => Ok(ApplyWithInvitePayload {
                application: Some(Application(application)),
                user_errors: vec![],
            }),
            Err(OnboardingError::Forbidden) => Err(forbidden()),
            Err(e) => Ok(ApplyWithInvitePayload {
                application: None,
                user_errors: vec![UserError::from_onboarding(&e, "")],
            }),
        }
    }

    /// Always succeeds, to avoid revealing whether an application
    /// exists.
    async fn resend_verification_email(
        &self,
        ctx: &Context<'_>,
        input: ResendVerificationEmailInput,
    ) -> async_graphql::Result<ResendVerificationEmailPayload> {
        let pool = ctx.data::<PgPool>()?;
        let mailer = ctx.data::<Arc<dyn Mailer>>()?;
        let web_origin = ctx.data::<WebOrigin>()?;
        let limits = ctx.data::<RateLimitConfig>()?;
        // Per-account resend budget (auth.md "Rate limiting") — tripping
        // it stays silent, because a visible refusal would leak what the
        // verb is built to hide.
        if let Ok(email) = auth::normalize_email(&input.email)
            && !ratelimit::within(pool, scope::RESEND_EMAIL, &email, limits.resend_email).await?
        {
            return Ok(ResendVerificationEmailPayload { ok: true });
        }
        if let Err(e) =
            onboarding::resend_verification(pool, mailer.as_ref(), &web_origin.0, &input.email)
                .await
        {
            tracing::error!(error = %e, "resend failed silently by design");
        }
        Ok(ResendVerificationEmailPayload { ok: true })
    }

    /// Approve staged applicants — the inviter's deliberate, priced act:
    /// per applicant or in batch, with the pre-filled stance values
    /// adjusted at will. Triggers the funding burn and the staged
    /// Registration backend-side, and returns the inviter's own Opinion
    /// records to sign — the vouch is the inviter's signature, not a
    /// server write. Requires an approvable application: email verified
    /// and key attached.
    async fn approve_applicants(
        &self,
        ctx: &Context<'_>,
        input: ApproveApplicantsInput,
    ) -> async_graphql::Result<PreparePayload> {
        let v = member_viewer(ctx).await?;
        let pool = ctx.data::<PgPool>()?;
        let boundary = ctx.data::<StandInBoundary>()?;
        let funding = ctx.data::<StandIn>()?;
        let cfg = ctx.data::<OnboardingConfig>()?;
        let approvals: Vec<onboarding::Approval> = input
            .approvals
            .iter()
            .map(|a| onboarding::Approval {
                application: a.application,
                p_d: a.p_directed.0,
                p_i: a.p_interest.0,
            })
            .collect();
        match onboarding::approve_applicants(pool, boundary, funding, cfg, v.user_id, &approvals)
            .await
        {
            Ok(prepared) => Ok(PreparePayload {
                writes: Some(
                    prepared
                        .into_iter()
                        .map(PreparedWrite::from_prepared)
                        .collect(),
                ),
                user_errors: vec![],
            }),
            Err(errors) => Ok(PreparePayload {
                writes: None,
                user_errors: errors
                    .into_iter()
                    .map(|(i, e)| {
                        let mut err = UserError::from_onboarding(&e, "");
                        let mut path = vec!["approvals".to_string(), i.to_string()];
                        if let Some(inner) = err.field.take() {
                            path.extend(inner);
                        }
                        err.field = Some(path);
                        err
                    })
                    .collect(),
            }),
        }
    }

    /// A session from credentials; `auth` is null with an
    /// INVALID_CREDENTIALS userError when the email / password pair did
    /// not match.
    async fn log_in(
        &self,
        ctx: &Context<'_>,
        input: LogInInput,
    ) -> async_graphql::Result<LogInPayload> {
        let pool = ctx.data::<PgPool>()?;
        let auth_cfg = ctx.data::<AuthConfig>()?;
        let limits = ctx.data::<RateLimitConfig>()?;
        // Per-IP window first, then the per-email consecutive-failure
        // backoff (auth.md "Rate limiting").
        guard_window(ctx, scope::LOGIN_IP, &request_ip(ctx)?, limits.login_ip).await?;
        let refused = || {
            Ok(LogInPayload {
                auth: None,
                reuse_detected_at: None,
                user_errors: vec![UserError::new(
                    ErrorCode::InvalidCredentials,
                    "email / password pair did not match",
                )],
            })
        };
        let Ok(email) = auth::normalize_email(&input.email) else {
            return refused();
        };
        if ratelimit::login_blocked(pool, &email).await?.is_some() {
            return Err(rate_limited());
        }
        let Some(credentials) = store::credentials_by_email(pool, &email).await? else {
            // Hash anyway so a missing account costs the same time as a
            // wrong password.
            let _ = auth::verify_password(
                "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                &input.password,
            );
            ratelimit::login_failed(pool, limits, &email).await?;
            return refused();
        };
        if !auth::verify_password(&credentials.password_hash, &input.password) {
            ratelimit::login_failed(pool, limits, &email).await?;
            return refused();
        }
        ratelimit::login_succeeded(pool, &email).await?;
        // Take-and-clear only behind a verified password: the pending
        // mark must never leak through a refusal.
        let reuse_detected_at = store::take_reuse_detected(pool, credentials.actor_id).await?;
        let issued = auth::issue_session(
            pool,
            auth_cfg,
            credentials.actor_id,
            input.device_label.as_deref(),
        )
        .await
        .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        Ok(LogInPayload {
            auth: Some(AuthSession::from_issued(issued)),
            reuse_detected_at,
            user_errors: vec![],
        })
    }

    /// A rotated session; `auth` is null with a REFRESH_TOKEN_INVALID
    /// userError when the refresh token is invalid, expired, or
    /// revoked. A just-rotated token's replay inside the grace window
    /// returns the same successor; outside it, reuse detection revokes
    /// every session.
    async fn refresh_session(
        &self,
        ctx: &Context<'_>,
        input: RefreshSessionInput,
    ) -> async_graphql::Result<RefreshPayload> {
        let pool = ctx.data::<PgPool>()?;
        let auth_cfg = ctx.data::<AuthConfig>()?;
        match auth::refresh_session(pool, auth_cfg, &input.refresh_token).await {
            Ok(issued) => Ok(RefreshPayload {
                auth: Some(AuthSession::from_issued(issued)),
                user_errors: vec![],
            }),
            Err(RefreshError::Invalid) | Err(RefreshError::Reuse) => Ok(RefreshPayload {
                auth: None,
                user_errors: vec![UserError::new(
                    ErrorCode::RefreshTokenInvalid,
                    "refresh token invalid, expired, or reuse-detected",
                )],
            }),
            Err(e) => Ok(RefreshPayload {
                auth: None,
                user_errors: vec![internal(e)],
            }),
        }
    }

    /// Revoke one session (the current one if no id is given). The
    /// associated access token cannot be invalidated mid-TTL but cannot
    /// be refreshed past expiry.
    async fn revoke_session(
        &self,
        ctx: &Context<'_>,
        input: RevokeSessionInput,
    ) -> async_graphql::Result<RevokeSessionPayload> {
        let v = viewer(ctx)?;
        let pool = ctx.data::<PgPool>()?;
        let target = input.session.unwrap_or(v.session_id);
        if !store::revoke_session(pool, target, v.user_id).await? {
            return Ok(RevokeSessionPayload {
                session: None,
                user_errors: vec![UserError::at(
                    ErrorCode::NotFound,
                    "no such active session",
                    vec!["session".to_string()],
                )],
            });
        }
        Ok(RevokeSessionPayload {
            session: store::session(pool, target).await?.map(|row| Session {
                row,
                current_session: Some(v.session_id),
            }),
            user_errors: vec![],
        })
    }

    /// Revoke every session except the one making the request.
    async fn revoke_other_sessions(
        &self,
        ctx: &Context<'_>,
    ) -> async_graphql::Result<RevokeSessionsPayload> {
        let v = viewer(ctx)?;
        let pool = ctx.data::<PgPool>()?;
        let revoked =
            store::revoke_sessions(pool, v.user_id, Some(v.session_id), RevokedReason::Owner)
                .await?;
        Ok(RevokeSessionsPayload {
            revoked_count: Some(revoked as i32),
            user_errors: vec![],
        })
    }

    /// Always succeeds, to avoid revealing whether an account exists. If
    /// one does, a single-use reset link goes to its address.
    async fn request_password_reset(
        &self,
        ctx: &Context<'_>,
        input: RequestPasswordResetInput,
    ) -> async_graphql::Result<RequestPasswordResetPayload> {
        let pool = ctx.data::<PgPool>()?;
        let mailer = ctx.data::<Arc<dyn Mailer>>()?;
        let limits = ctx.data::<RateLimitConfig>()?;
        // Per-IP visibly; per-email silently (auth.md "Rate limiting"):
        // tripping the email budget returns the same `ok: true`.
        guard_window(ctx, scope::RESET_IP, &request_ip(ctx)?, limits.reset_ip).await?;
        if let Ok(email) = auth::normalize_email(&input.email)
            && ratelimit::within(pool, scope::RESET_EMAIL, &email, limits.reset_email).await?
            && let Some(credentials) = store::credentials_by_email(pool, &email).await?
        {
            let secret = auth::new_secret();
            store::create_password_reset(
                pool,
                Uuid::new_v4(),
                credentials.actor_id,
                &secret.hash,
                Utc::now() + Duration::minutes(PASSWORD_RESET_TTL_MINUTES),
            )
            .await?;
            let web_origin = ctx.data::<WebOrigin>()?;
            mailer
                .send(Mail {
                    to: email,
                    subject: "Reset your CoGra password".into(),
                    // The link URL (auth.md "Link URLs") plus the bare
                    // token native apps accept as a paste.
                    body: format!(
                        "Reset your password: {origin}/reset?token={token}\nOr paste the token in the app: {token}\n\nValid {PASSWORD_RESET_TTL_MINUTES} minutes.",
                        origin = web_origin.0,
                        token = secret.token
                    ),
                })
                .await;
        }
        Ok(RequestPasswordResetPayload { ok: true })
    }

    /// Rotates the password and revokes every session — a reset is a
    /// security event.
    async fn confirm_password_reset(
        &self,
        ctx: &Context<'_>,
        input: ConfirmPasswordResetInput,
    ) -> async_graphql::Result<ConfirmPasswordResetPayload> {
        let pool = ctx.data::<PgPool>()?;
        let limits = ctx.data::<RateLimitConfig>()?;
        let corpus = ctx.data::<Arc<dyn BreachCorpus>>()?;
        guard_window(ctx, scope::CONFIRM_IP, &request_ip(ctx)?, limits.confirm_ip).await?;
        if let Err(m) = auth::validate_new_password(corpus.as_ref(), &input.new_password).await {
            return Ok(ConfirmPasswordResetPayload {
                ok: None,
                user_errors: vec![UserError::at(
                    ErrorCode::WeakPassword,
                    m,
                    vec!["newPassword".to_string()],
                )],
            });
        }
        let Some(user_id) =
            store::consume_password_reset(pool, &auth::hash_of(&input.reset_token)).await?
        else {
            return Ok(ConfirmPasswordResetPayload {
                ok: None,
                user_errors: vec![UserError::at(
                    ErrorCode::ResetTokenInvalid,
                    "reset token invalid, expired, or used",
                    vec!["resetToken".to_string()],
                )],
            });
        };
        let hash = auth::hash_password(&input.new_password)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        store::update_password_hash(pool, user_id, &hash).await?;
        store::revoke_sessions(pool, user_id, None, RevokedReason::Security).await?;
        Ok(ConfirmPasswordResetPayload {
            ok: Some(true),
            user_errors: vec![],
        })
    }

    /// Re-verifies the current password, rotates the hash, and revokes
    /// the account's other sessions.
    async fn change_password(
        &self,
        ctx: &Context<'_>,
        input: ChangePasswordInput,
    ) -> async_graphql::Result<ChangePasswordPayload> {
        let v = viewer(ctx)?;
        let pool = ctx.data::<PgPool>()?;
        let Some(credentials) = store::credentials_by_actor(pool, v.user_id).await? else {
            return Err(unauthenticated());
        };
        if !auth::verify_password(&credentials.password_hash, &input.current_password) {
            return Ok(ChangePasswordPayload {
                ok: None,
                user_errors: vec![UserError::at(
                    ErrorCode::InvalidCredentials,
                    "current password did not match",
                    vec!["currentPassword".to_string()],
                )],
            });
        }
        let corpus = ctx.data::<Arc<dyn BreachCorpus>>()?;
        if let Err(m) = auth::validate_new_password(corpus.as_ref(), &input.new_password).await {
            return Ok(ChangePasswordPayload {
                ok: None,
                user_errors: vec![UserError::at(
                    ErrorCode::WeakPassword,
                    m,
                    vec!["newPassword".to_string()],
                )],
            });
        }
        let hash = auth::hash_password(&input.new_password)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        store::update_password_hash(pool, v.user_id, &hash).await?;
        store::revoke_sessions(pool, v.user_id, Some(v.session_id), RevokedReason::Security)
            .await?;
        Ok(ChangePasswordPayload {
            ok: Some(true),
            user_errors: vec![],
        })
    }

    /// Re-authenticates with the current password, then runs the
    /// two-sided proof: a confirmation code to the current address, a
    /// verification link to the new one. Always succeeds for a
    /// well-formed request, to avoid revealing whether the new address
    /// is already registered.
    async fn request_email_change(
        &self,
        ctx: &Context<'_>,
        input: RequestEmailChangeInput,
    ) -> async_graphql::Result<RequestEmailChangePayload> {
        let v = viewer(ctx)?;
        let pool = ctx.data::<PgPool>()?;
        let mailer = ctx.data::<Arc<dyn Mailer>>()?;
        let Some(credentials) = store::credentials_by_actor(pool, v.user_id).await? else {
            return Err(unauthenticated());
        };
        if !auth::verify_password(&credentials.password_hash, &input.current_password) {
            // Silent by design; a wrong password still reads as success.
            return Ok(RequestEmailChangePayload { ok: true });
        }
        let Ok(new_email) = auth::normalize_email(&input.new_email) else {
            return Ok(RequestEmailChangePayload { ok: true });
        };
        let original_code = auth::new_secret();
        let new_token = auth::new_secret();
        store::create_email_change(
            pool,
            Uuid::new_v4(),
            v.user_id,
            &new_email,
            &original_code.hash,
            &new_token.hash,
            Utc::now() + Duration::hours(EMAIL_CHANGE_TTL_HOURS),
        )
        .await?;
        mailer
            .send(Mail {
                to: credentials.email,
                subject: "Confirm your CoGra email change".into(),
                body: format!(
                    "Your confirmation code (valid {EMAIL_CHANGE_TTL_HOURS} h): {}",
                    original_code.token
                ),
            })
            .await;
        mailer
            .send(Mail {
                to: new_email,
                subject: "Verify your new CoGra address".into(),
                body: format!(
                    "Your verification token (valid {EMAIL_CHANGE_TTL_HOURS} h): {}",
                    new_token.token
                ),
            })
            .await;
        Ok(RequestEmailChangePayload { ok: true })
    }

    /// Submits either side's proof; the change applies — and the account
    /// email updates — only once both the original-address code and the
    /// new-address verification have been confirmed. A fully-proven
    /// change whose new address was registered by someone else in the
    /// meantime surfaces EMAIL_IN_USE, on this call and on retries,
    /// until the change expires.
    async fn confirm_email_change(
        &self,
        ctx: &Context<'_>,
        input: ConfirmEmailChangeInput,
    ) -> async_graphql::Result<ConfirmEmailChangePayload> {
        let v = viewer(ctx)?;
        let pool = ctx.data::<PgPool>()?;
        let limits = ctx.data::<RateLimitConfig>()?;
        guard_window(ctx, scope::CONFIRM_IP, &request_ip(ctx)?, limits.confirm_ip).await?;
        let hash = auth::hash_of(&input.code);
        // Either side's proof may arrive first; the change applies only
        // once both stand.
        let matched = store::confirm_email_change_new_side(pool, v.user_id, &hash).await?
            || store::confirm_email_change_original_side(pool, v.user_id, &hash).await?;
        // The apply step runs even when the code matched nothing: a
        // fully-proven change that collided with another account's email
        // keeps its row alive, so a retry with an already-consumed code
        // still learns the real reason instead of a token error.
        let user_errors = match store::apply_email_change_if_complete(pool, v.user_id).await? {
            store::EmailChangeApply::Applied => vec![],
            store::EmailChangeApply::NotReady if matched => vec![],
            store::EmailChangeApply::NotReady => {
                return Ok(ConfirmEmailChangePayload {
                    user: None,
                    user_errors: vec![UserError::at(
                        ErrorCode::VerificationTokenInvalid,
                        "code invalid, expired, or already used",
                        vec!["code".to_string()],
                    )],
                });
            }
            store::EmailChangeApply::EmailInUse => vec![UserError::new(
                ErrorCode::EmailInUse,
                "the new address is already registered to another account",
            )],
        };
        let user = store::actor_identity(pool, v.user_id)
            .await?
            .map(|identity| User::from_viewer(identity, v));
        Ok(ConfirmEmailChangePayload { user, user_errors })
    }

    /// Renames the account in the one actor namespace — L2 account
    /// state, not graph or profile payload. Subject to the global handle
    /// rules: 3–30 chars of [a-z0-9_], case-folded.
    async fn change_handle(
        &self,
        ctx: &Context<'_>,
        input: ChangeHandleInput,
    ) -> async_graphql::Result<ChangeHandlePayload> {
        let v = viewer(ctx)?;
        let pool = ctx.data::<PgPool>()?;
        let handle = match auth::normalize_handle(&input.handle) {
            Ok(h) => h,
            Err(m) => {
                return Ok(ChangeHandlePayload {
                    user: None,
                    user_errors: vec![UserError::at(
                        ErrorCode::BadInput,
                        m,
                        vec!["handle".to_string()],
                    )],
                });
            }
        };
        if !store::change_handle(pool, v.user_id, &handle).await? {
            return Ok(ChangeHandlePayload {
                user: None,
                user_errors: vec![UserError::at(
                    ErrorCode::HandleTaken,
                    "handle already taken",
                    vec!["handle".to_string()],
                )],
            });
        }
        Ok(ChangeHandlePayload {
            user: store::actor_identity(pool, v.user_id)
                .await?
                .map(|identity| User::from_viewer(identity, v)),
            user_errors: vec![],
        })
    }

    /// Issues the challenge an upload must spend (auth.md "Key
    /// recovery"). The server picks it: a client-chosen nonce would let
    /// a captured upload be replayed verbatim, which is the whole attack
    /// the proof exists to stop. Asking again discards the previous one.
    async fn create_key_backup_challenge(
        &self,
        ctx: &Context<'_>,
    ) -> async_graphql::Result<KeyBackupChallengePayload> {
        let v = viewer(ctx)?;
        let pool = ctx.data::<PgPool>()?;
        if actor_pubkey(pool, v.user_id).await?.is_none() {
            return Err(forbidden());
        }
        let mut challenge = vec![0u8; key_backup::CHALLENGE_LEN];
        OsRng.fill_bytes(&mut challenge);
        let expires_at = Utc::now() + Duration::minutes(KEY_BACKUP_CHALLENGE_TTL_MINUTES);
        store::issue_key_backup_challenge(pool, v.user_id, &challenge, expires_at).await?;
        Ok(KeyBackupChallengePayload {
            challenge: Some(B64.encode(&challenge)),
            expires_at: Some(expires_at),
            user_errors: vec![],
        })
    }

    /// Upload (or replace) the client-encrypted key-backup blob —
    /// ciphertext under the device-generated recovery code; the server
    /// stores what it cannot decrypt. One blob per account; blobs over
    /// 4 KiB refuse as BAD_INPUT. Retrieval is the `User.keyBackup`
    /// field: login + code is the recovery.
    ///
    /// The upload is signed by the actor key over a server-issued
    /// challenge (auth.md "Key recovery"): a session alone could
    /// otherwise overwrite the blob and silently destroy the account's
    /// recovery path. Replacing an existing blob mails a notice.
    async fn upload_key_backup(
        &self,
        ctx: &Context<'_>,
        input: UploadKeyBackupInput,
    ) -> async_graphql::Result<UploadKeyBackupPayload> {
        let v = viewer(ctx)?;
        let pool = ctx.data::<PgPool>()?;
        let mailer = ctx.data::<Arc<dyn Mailer>>()?;
        let refuse = |e: UserError| {
            Ok(UploadKeyBackupPayload {
                ok: None,
                user_errors: vec![e],
            })
        };

        let (blob, challenge, signature) = match (
            decode_b64("blob", &input.blob),
            decode_b64("challenge", &input.challenge),
            decode_b64("signature", &input.signature),
        ) {
            (Ok(blob), Ok(challenge), Ok(signature)) => (blob, challenge, signature),
            (Err(e), _, _) | (_, Err(e), _) | (_, _, Err(e)) => return refuse(e),
        };
        if blob.len() > MAX_KEY_BACKUP_BYTES {
            return refuse(UserError::at(
                ErrorCode::BadInput,
                format!("blob exceeds {MAX_KEY_BACKUP_BYTES} bytes"),
                vec!["blob".to_string()],
            ));
        }

        // No attached key means nothing to verify against, and no
        // legitimate caller — the ceremony attaches before it uploads.
        let Some(pubkey) = actor_pubkey(pool, v.user_id).await? else {
            return Err(forbidden());
        };
        let Some(verifying) = crypto::verifying_key_from_bytes(&pubkey) else {
            return refuse(internal("the stored actor pubkey is not an Ed25519 key"));
        };
        // Verify before spending: a bad signature must not burn the
        // challenge, or a wrong-key client would need a fresh round trip
        // per attempt for no security gain.
        if !key_backup::verify_upload(&verifying, &challenge, &blob, &signature) {
            return refuse(UserError::at(
                ErrorCode::SignatureInvalid,
                "the upload proof does not verify under the account's actor key",
                vec!["signature".to_string()],
            ));
        }
        if !store::consume_key_backup_challenge(pool, v.user_id, &challenge, Utc::now()).await? {
            return refuse(UserError::at(
                ErrorCode::ChallengeExpired,
                "the challenge is unknown, expired, or already spent",
                vec!["challenge".to_string()],
            ));
        }

        let replaced = store::has_key_backup(pool, v.user_id).await?;
        store::upload_key_backup(pool, v.user_id, &blob).await?;
        if replaced && let Some(credentials) = store::credentials_by_actor(pool, v.user_id).await? {
            mailer
                .send(Mail {
                    to: credentials.email,
                    subject: "Your CoGra recovery code was replaced".into(),
                    body: "Someone replaced the recovery code on your CoGra \
                           account just now. Your previous code no longer opens \
                           your key backup.\n\n\
                           If that was you, nothing to do — keep the new code safe.\n\n\
                           If it wasn't, someone has access to a device holding \
                           your actor key. Sign out every session and change your \
                           password from Settings."
                        .into(),
                })
                .await;
        }
        Ok(UploadKeyBackupPayload {
            ok: Some(true),
            user_errors: vec![],
        })
    }

    /// Issues an invite link — pure service-side staging UX; its id is
    /// the shareable capability. Nothing binds at issue: the stance
    /// values are pre-filled suggestions, and the approval is the priced
    /// act.
    async fn create_invite_link(
        &self,
        ctx: &Context<'_>,
        input: CreateInviteLinkInput,
    ) -> async_graphql::Result<CreateInviteLinkPayload> {
        let v = member_viewer(ctx).await?;
        let pool = ctx.data::<PgPool>()?;
        if input.expires_at <= Utc::now() {
            return Ok(CreateInviteLinkPayload {
                invite_link: None,
                user_errors: vec![UserError::at(
                    ErrorCode::BadInput,
                    "expiry must lie in the future",
                    vec!["expiresAt".to_string()],
                )],
            });
        }
        let link = store::create_invite_link(
            pool,
            Uuid::new_v4(),
            v.user_id,
            input.prefill_p_directed.0,
            input.prefill_p_interest.0,
            input.single_use.unwrap_or(false),
            input.expires_at,
        )
        .await?;
        Ok(CreateInviteLinkPayload {
            invite_link: Some(InviteLink(link)),
            user_errors: vec![],
        })
    }

    /// Revokes one of the viewer's own invite links.
    async fn revoke_invite_link(
        &self,
        ctx: &Context<'_>,
        input: RevokeInviteLinkInput,
    ) -> async_graphql::Result<RevokeInviteLinkPayload> {
        let v = member_viewer(ctx).await?;
        let pool = ctx.data::<PgPool>()?;
        if !store::revoke_invite_link(pool, input.invite_link, v.user_id).await? {
            return Ok(RevokeInviteLinkPayload {
                invite_link: None,
                user_errors: vec![UserError::at(
                    ErrorCode::NotFound,
                    "no such live invite link",
                    vec!["inviteLink".to_string()],
                )],
            });
        }
        Ok(RevokeInviteLinkPayload {
            invite_link: store::invite_link(pool, input.invite_link)
                .await?
                .map(InviteLink),
            user_errors: vec![],
        })
    }

    /// Prepares the viewer's stance toward a target as the delta record
    /// whose bundle nets to the stated intent. Toward a Profile this is
    /// the reciprocation gesture completing the CoGra-join mutual pair.
    async fn prepare_stance(
        &self,
        ctx: &Context<'_>,
        input: PrepareStanceInput,
    ) -> async_graphql::Result<PreparePayload> {
        let v = member_viewer(ctx).await?;
        let pool = ctx.data::<PgPool>()?;
        let boundary = ctx.data::<StandInBoundary>()?;
        let cfg = ctx.data::<OnboardingConfig>()?;
        match stance::prepare_stance(
            pool,
            boundary,
            cfg.gc_after_epochs,
            v.user_id,
            input.target,
            input.p_directed.0,
            input.p_interest.0,
        )
        .await
        {
            Ok(prepared) => Ok(PreparePayload {
                writes: Some(vec![PreparedWrite::from_prepared(prepared)]),
                user_errors: vec![],
            }),
            Err(StanceError::BadInput { field, message }) => Ok(PreparePayload {
                writes: None,
                user_errors: vec![UserError::at(
                    ErrorCode::BadInput,
                    message,
                    vec![field.to_string()],
                )],
            }),
            Err(StanceError::Prepare(e)) => Ok(PreparePayload {
                writes: None,
                user_errors: vec![UserError::from_onboarding(&OnboardingError::from(e), "")],
            }),
            Err(e) => Ok(PreparePayload {
                writes: None,
                user_errors: vec![internal(e)],
            }),
        }
    }

    /// Prepares a new Post: one genesis Publish through the ordinary
    /// write path — the returned write pre-signs, seals, and approves
    /// like any other; `node` is the id the post serves under once the
    /// record lands (post.md §1).
    async fn prepare_post(
        &self,
        ctx: &Context<'_>,
        input: PreparePostInput,
    ) -> async_graphql::Result<PrepareContentPayload> {
        let v = member_viewer(ctx).await?;
        let pool = ctx.data::<PgPool>()?;
        let boundary = ctx.data::<StandInBoundary>()?;
        let cfg = ctx.data::<OnboardingConfig>()?;
        let draft = crate::content::PostDraft {
            title: input.title,
            description: input.description,
            content: input.content,
            license: input.license.to_content(),
            p_directed: input.p_directed.map(|d| d.0),
        };
        match crate::content::prepare_post(pool, boundary, cfg.gc_after_epochs, v.user_id, draft)
            .await
        {
            Ok(prepared) => Ok(PrepareContentPayload::ok(prepared)),
            Err(e) => Ok(PrepareContentPayload::from_error(e)),
        }
    }

    /// Prepares a Post edit: an ordinary-role Publish at attachment 0
    /// toward the existing node, chained behind the current head.
    /// Creator-only; one in-flight edit per post and author
    /// (post.md §4).
    async fn prepare_post_edit(
        &self,
        ctx: &Context<'_>,
        input: PreparePostEditInput,
    ) -> async_graphql::Result<PrepareContentPayload> {
        let v = member_viewer(ctx).await?;
        let pool = ctx.data::<PgPool>()?;
        let boundary = ctx.data::<StandInBoundary>()?;
        let cfg = ctx.data::<OnboardingConfig>()?;
        let draft = crate::content::PostEditDraft {
            id: input.id,
            title: edit_field(input.title),
            description: edit_field(input.description),
            content: edit_field(input.content),
        };
        match crate::content::prepare_post_edit(
            pool,
            boundary,
            cfg.gc_after_epochs,
            v.user_id,
            draft,
        )
        .await
        {
            Ok(prepared) => Ok(PrepareContentPayload::ok(prepared)),
            Err(e) => Ok(PrepareContentPayload::from_error(e)),
        }
    }

    /// Prepares a new Comment: one genesis Review whose terminal leg
    /// mints the Comment on the target (comment.md §1).
    async fn prepare_comment(
        &self,
        ctx: &Context<'_>,
        input: PrepareCommentInput,
    ) -> async_graphql::Result<PrepareContentPayload> {
        let v = member_viewer(ctx).await?;
        let pool = ctx.data::<PgPool>()?;
        let boundary = ctx.data::<StandInBoundary>()?;
        let cfg = ctx.data::<OnboardingConfig>()?;
        let draft = crate::content::CommentDraft {
            target: input.target,
            content: input.content,
            license: input.license.to_content(),
            p_directed: input.p_directed.map(|d| d.0),
            p_interest: input.p_interest.map(|d| d.0),
        };
        match crate::content::prepare_comment(pool, boundary, cfg.gc_after_epochs, v.user_id, draft)
            .await
        {
            Ok(prepared) => Ok(PrepareContentPayload::ok(prepared)),
            Err(e) => Ok(PrepareContentPayload::from_error(e)),
        }
    }

    /// Prepares a Comment edit: an ordinary-role Review at (0,0) — A
    /// leg to the genesis parent, terminal leg to the existing Comment
    /// (comment.md §4).
    async fn prepare_comment_edit(
        &self,
        ctx: &Context<'_>,
        input: PrepareCommentEditInput,
    ) -> async_graphql::Result<PrepareContentPayload> {
        let v = member_viewer(ctx).await?;
        let pool = ctx.data::<PgPool>()?;
        let boundary = ctx.data::<StandInBoundary>()?;
        let cfg = ctx.data::<OnboardingConfig>()?;
        let draft = crate::content::CommentEditDraft {
            id: input.id,
            content: edit_field(input.content),
        };
        match crate::content::prepare_comment_edit(
            pool,
            boundary,
            cfg.gc_after_epochs,
            v.user_id,
            draft,
        )
        .await
        {
            Ok(prepared) => Ok(PrepareContentPayload::ok(prepared)),
            Err(e) => Ok(PrepareContentPayload::from_error(e)),
        }
    }

    /// Relays the pre-signed proposals to L1's seal round trip. When the
    /// seal returns synchronously the payload's staged writes are
    /// already AWAITING_APPROVAL, verified act included. Verification
    /// failures surface as SIGNATURE_INVALID userErrors per proposal.
    /// Resubmitting a sealed proposal is idempotent only for the exact
    /// signature that was sealed; differing bytes refuse as BAD_INPUT.
    async fn submit_proposals(
        &self,
        ctx: &Context<'_>,
        input: SubmitProposalsInput,
    ) -> async_graphql::Result<SubmitProposalsPayload> {
        let v = viewer(ctx)?;
        let pool = ctx.data::<PgPool>()?;
        let boundary = ctx.data::<StandInBoundary>()?;
        let identity = store::actor_identity(pool, v.user_id)
            .await?
            .ok_or_else(unauthenticated)?;
        // No staged write exists for a keyless account — the Registration
        // stages only after the attach proof — so a missing key here is a
        // client bug, not a state to render.
        let author_pubkey = identity.actor_pubkey.ok_or_else(forbidden)?;
        let mut writes = Vec::with_capacity(input.proposals.len());
        let mut user_errors = Vec::new();
        for (i, proposal) in input.proposals.iter().enumerate() {
            let owned = match staged::load(pool, proposal.staged_write_id).await {
                Ok(w) if w.actor_id == v.user_id => w,
                Ok(_) | Err(staged::StagedError::NotFound(_)) => {
                    user_errors.push(UserError::at(
                        ErrorCode::NotFound,
                        "unknown staged write",
                        vec!["proposals".to_string(), i.to_string()],
                    ));
                    continue;
                }
                Err(e) => {
                    user_errors.push(internal(e));
                    continue;
                }
            };
            let blob = decode_b64("signature", &proposal.signature).and_then(|raw| {
                wire::decode_pre_commitment(&raw).map_err(|_| {
                    UserError::at(
                        ErrorCode::BadInput,
                        "not a pre-commitment blob",
                        vec!["proposals".to_string(), i.to_string()],
                    )
                })
            });
            let (nonce, pre_signature) = match blob {
                Ok(b) => b,
                Err(e) => {
                    user_errors.push(e);
                    continue;
                }
            };
            match relay::submit_pre_signed(
                boundary,
                pool,
                owned.id,
                PreSignedParts {
                    author_pubkey: author_pubkey.clone(),
                    nonce,
                    pre_signature,
                },
            )
            .await
            {
                Ok(_) => match staged::load(pool, owned.id).await {
                    Ok(w) => writes.push(StagedWriteType(w)),
                    Err(e) => user_errors.push(internal(e)),
                },
                Err(e) => user_errors.push(relay_error(e, i)),
            }
        }
        if user_errors.is_empty() {
            Ok(SubmitProposalsPayload {
                staged_writes: Some(writes),
                user_errors,
            })
        } else {
            Ok(SubmitProposalsPayload {
                staged_writes: None,
                user_errors,
            })
        }
    }

    /// Relays the approval witnesses — only an approved act is orderable
    /// — and drives retries across epoch boundaries. Landing stays
    /// asynchronous; observe via `stagedWrite`.
    async fn approve_acts(
        &self,
        ctx: &Context<'_>,
        input: ApproveActsInput,
    ) -> async_graphql::Result<ApproveActsPayload> {
        let v = viewer(ctx)?;
        let pool = ctx.data::<PgPool>()?;
        let boundary = ctx.data::<StandInBoundary>()?;
        let mut writes = Vec::with_capacity(input.approvals.len());
        let mut user_errors = Vec::new();
        for (i, approval) in input.approvals.iter().enumerate() {
            let owned = match staged::load(pool, approval.staged_write_id).await {
                Ok(w) if w.actor_id == v.user_id => w,
                Ok(_) | Err(staged::StagedError::NotFound(_)) => {
                    user_errors.push(UserError::at(
                        ErrorCode::NotFound,
                        "unknown staged write",
                        vec!["approvals".to_string(), i.to_string()],
                    ));
                    continue;
                }
                Err(e) => {
                    user_errors.push(internal(e));
                    continue;
                }
            };
            let signature = match decode_b64("signature", &approval.signature) {
                Ok(b) => b,
                Err(mut e) => {
                    e.field = Some(vec!["approvals".to_string(), i.to_string()]);
                    user_errors.push(e);
                    continue;
                }
            };
            match relay::submit_approval(boundary, pool, owned.id, signature).await {
                Ok(()) => match staged::load(pool, owned.id).await {
                    Ok(w) => writes.push(StagedWriteType(w)),
                    Err(e) => user_errors.push(internal(e)),
                },
                Err(e) => user_errors.push(relay_error(e, i)),
            }
        }
        if user_errors.is_empty() {
            Ok(ApproveActsPayload {
                staged_writes: Some(writes),
                user_errors,
            })
        } else {
            Ok(ApproveActsPayload {
                staged_writes: None,
                user_errors,
            })
        }
    }
}
