//! The slice-1 mutation surface (api-spec.md "Auth and accounts", "The
//! write flow"): the applicant flow and its token-authorized twins,
//! sessions and credentials, invite links, and the generic write-path
//! relay legs. Conventions: one `input` argument, a dedicated payload,
//! `userErrors` empty exactly on success — except the three
//! deliberately-silent verbs, which carry no `userErrors` at all.

use std::sync::Arc;

use async_graphql::{Context, InputObject, Object, SimpleObject};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use chrono::{DateTime, Duration, Utc};
use common::l1::wire;
use l1_standin::StandIn;
use postgres_store::staged::{PreSignedParts, StagedBy};
use postgres_store::{PgPool, auth as store, staged};
use uuid::Uuid;

use super::types::{
    ApplicationView, AuthSession, Dimension, ErrorCode, InviteLink, PreparedWrite, Session,
    StagedWriteType, User, UserError,
};
use crate::auth::{self, AuthConfig, RefreshError, Viewer};
use crate::l1::StandInBoundary;
use crate::mailer::{Mail, Mailer};
use crate::onboarding::{self, OnboardingConfig, OnboardingError};
use crate::relay::{self, RelayError};
use crate::stance::{self, StanceError};

/// Email-change proofs stay live this long (auth.md "Email change" —
/// single-use, short-lived; long enough to open a mailbox on another
/// device).
const EMAIL_CHANGE_TTL_HOURS: i64 = 1;
/// Password-reset tokens stay live this long (auth.md default).
const PASSWORD_RESET_TTL_MINUTES: i64 = 15;

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

/// The application submit: the login triple plus the device key
/// ceremony's public outputs (the key never leaves the device; approval
/// funds a burn to the submitted address, so it must exist first).
#[derive(InputObject)]
struct SubmitApplicationInput {
    invite_link: Uuid,
    handle: String,
    email: String,
    password: String,
    /// The device-held actor key's public half (base64).
    actor_pubkey: String,
    /// The device-generated L0 address — the address approval funds.
    l0_address: String,
}

#[derive(SimpleObject)]
struct SubmitApplicationPayload {
    /// The opaque token authorizing exactly this applicant's own flow:
    /// status polling, registration signing, the landing claim. Null
    /// when `userErrors` is non-empty.
    applicant_token: Option<String>,
    /// When the application expires unverified (24 h, auth.md).
    expires_at: Option<DateTime<Utc>>,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct VerifyApplicantEmailInput {
    verification_token: String,
}

#[derive(SimpleObject)]
struct VerifyApplicantEmailPayload {
    /// False with a VERIFICATION_TOKEN_INVALID userError when the token
    /// is invalid or the application expired.
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

#[derive(InputObject)]
struct ApplicantApprovalInput {
    applicant: Uuid,
    /// Pre-filled from the link, committed here.
    p_directed: Dimension,
    p_interest: Dimension,
}

#[derive(InputObject)]
struct ApproveApplicantsInput {
    approvals: Vec<ApplicantApprovalInput>,
}

/// Staged proposals to pre-sign, in relay order. Each is its own priced
/// act running its own two-signature handshake; null when `userErrors`
/// is non-empty.
#[derive(SimpleObject)]
struct PreparePayload {
    writes: Option<Vec<PreparedWrite>>,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct SubmitApplicantRegistrationInput {
    applicant_token: String,
    /// The pre-commitment blob (base64): the device's private nonce and
    /// pre-signature over the canonical proposal.
    signature: String,
}

#[derive(SimpleObject)]
struct SubmitApplicantRegistrationPayload {
    /// Carries the host-sealed verified act for the approval step.
    staged_write: Option<StagedWriteType>,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct ApproveApplicantRegistrationInput {
    applicant_token: String,
    /// The approval-witness signature over the exact verified act
    /// (base64).
    signature: String,
}

#[derive(SimpleObject)]
struct ApproveApplicantRegistrationPayload {
    staged_write: Option<StagedWriteType>,
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct ClaimLandedSessionInput {
    applicant_token: String,
    device_label: Option<String>,
}

#[derive(SimpleObject)]
struct ClaimLandedSessionPayload {
    /// The first session — mintable repeatedly while the applicant token
    /// is valid; the token is the secret.
    auth: Option<AuthSession>,
    user_errors: Vec<UserError>,
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
    user_errors: Vec<UserError>,
}

#[derive(InputObject)]
struct RefreshSessionInput {
    refresh_token: String,
}

#[derive(SimpleObject)]
struct RefreshPayload {
    /// A rotated session; null with a REFRESH_TOKEN_INVALID userError
    /// when the token is invalid, expired, or was already rotated —
    /// reuse also revokes every session.
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
}

#[derive(SimpleObject)]
struct UploadKeyBackupPayload {
    ok: Option<bool>,
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
    /// Creates the staged applicant row — off-graph service state only:
    /// no account, no records, nothing on the graph — and sends the
    /// verification email. On refusal, `userErrors` carries one of
    /// INVITE_UNUSABLE, HANDLE_TAKEN, WEAK_PASSWORD, or
    /// APPLICATION_IN_PROGRESS.
    async fn submit_application(
        &self,
        ctx: &Context<'_>,
        input: SubmitApplicationInput,
    ) -> async_graphql::Result<SubmitApplicationPayload> {
        let pool = ctx.data::<PgPool>()?;
        let mailer = ctx.data::<Arc<dyn Mailer>>()?;
        let actor_pubkey = match decode_b64("actorPubkey", &input.actor_pubkey) {
            Ok(b) => b,
            Err(e) => {
                return Ok(SubmitApplicationPayload {
                    applicant_token: None,
                    expires_at: None,
                    user_errors: vec![e],
                });
            }
        };
        match onboarding::submit_application(
            pool,
            mailer.as_ref(),
            onboarding::ApplicationInput {
                invite_link: input.invite_link,
                handle: input.handle,
                email: input.email,
                password: input.password,
                actor_pubkey,
                l0_address: input.l0_address,
            },
        )
        .await
        {
            Ok(submitted) => Ok(SubmitApplicationPayload {
                applicant_token: Some(submitted.applicant_token),
                expires_at: Some(submitted.expires_at),
                user_errors: vec![],
            }),
            Err(e) => Ok(SubmitApplicationPayload {
                applicant_token: None,
                expires_at: None,
                user_errors: vec![UserError::from_onboarding(&e, "")],
            }),
        }
    }

    /// Proves the login channel. `ok` is false with a
    /// VERIFICATION_TOKEN_INVALID userError when the token is invalid or
    /// the application expired.
    async fn verify_applicant_email(
        &self,
        ctx: &Context<'_>,
        input: VerifyApplicantEmailInput,
    ) -> async_graphql::Result<VerifyApplicantEmailPayload> {
        let pool = ctx.data::<PgPool>()?;
        match onboarding::verify_email(pool, &input.verification_token).await {
            Ok(()) => Ok(VerifyApplicantEmailPayload {
                ok: true,
                user_errors: vec![],
            }),
            Err(e) => Ok(VerifyApplicantEmailPayload {
                ok: false,
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
        if let Err(e) = onboarding::resend_verification(pool, mailer.as_ref(), &input.email).await {
            tracing::error!(error = %e, "resend failed silently by design");
        }
        Ok(ResendVerificationEmailPayload { ok: true })
    }

    /// Approve staged applicants — the inviter's deliberate, priced act:
    /// per applicant or in batch, with the pre-filled stance values
    /// adjusted at will. Triggers the funding burn and the staged
    /// Registration backend-side, and returns the inviter's own Opinion
    /// records to sign — the vouch is the inviter's signature, not a
    /// server write.
    async fn approve_applicants(
        &self,
        ctx: &Context<'_>,
        input: ApproveApplicantsInput,
    ) -> async_graphql::Result<PreparePayload> {
        let v = viewer(ctx)?;
        let pool = ctx.data::<PgPool>()?;
        let boundary = ctx.data::<StandInBoundary>()?;
        let funding = ctx.data::<StandIn>()?;
        let cfg = ctx.data::<OnboardingConfig>()?;
        let approvals: Vec<onboarding::Approval> = input
            .approvals
            .iter()
            .map(|a| onboarding::Approval {
                applicant: a.applicant,
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

    /// Pre-sign the staged Registration — the applicant-token twin of
    /// `submitProposals`, since no session exists before landing. The
    /// returned staged write carries the host-sealed verified act for
    /// the approval step.
    async fn submit_applicant_registration(
        &self,
        ctx: &Context<'_>,
        input: SubmitApplicantRegistrationInput,
    ) -> async_graphql::Result<SubmitApplicantRegistrationPayload> {
        let pool = ctx.data::<PgPool>()?;
        let boundary = ctx.data::<StandInBoundary>()?;
        let funding = ctx.data::<StandIn>()?;
        let cfg = ctx.data::<OnboardingConfig>()?;
        let blob = match decode_b64("signature", &input.signature).and_then(|raw| {
            wire::decode_pre_commitment(&raw).map_err(|_| {
                UserError::at(
                    ErrorCode::BadInput,
                    "not a pre-commitment blob",
                    vec!["signature".to_string()],
                )
            })
        }) {
            Ok(b) => b,
            Err(e) => {
                return Ok(SubmitApplicantRegistrationPayload {
                    staged_write: None,
                    user_errors: vec![e],
                });
            }
        };
        match onboarding::submit_applicant_registration(
            pool,
            boundary,
            funding,
            cfg,
            &input.applicant_token,
            blob.0,
            blob.1,
        )
        .await
        {
            Ok(w) => Ok(SubmitApplicantRegistrationPayload {
                staged_write: Some(StagedWriteType(w)),
                user_errors: vec![],
            }),
            Err(e) => Ok(SubmitApplicantRegistrationPayload {
                staged_write: None,
                user_errors: vec![UserError::from_onboarding(&e, "")],
            }),
        }
    }

    /// Relay the approval witness — the applicant-token twin of
    /// `approveActs`; the device verifies the seal, the exact body, and
    /// both commitment openings first. Landing stays asynchronous.
    async fn approve_applicant_registration(
        &self,
        ctx: &Context<'_>,
        input: ApproveApplicantRegistrationInput,
    ) -> async_graphql::Result<ApproveApplicantRegistrationPayload> {
        let pool = ctx.data::<PgPool>()?;
        let boundary = ctx.data::<StandInBoundary>()?;
        let signature = match decode_b64("signature", &input.signature) {
            Ok(b) => b,
            Err(e) => {
                return Ok(ApproveApplicantRegistrationPayload {
                    staged_write: None,
                    user_errors: vec![e],
                });
            }
        };
        match onboarding::approve_applicant_registration(
            pool,
            boundary,
            &input.applicant_token,
            signature,
        )
        .await
        {
            Ok(w) => Ok(ApproveApplicantRegistrationPayload {
                staged_write: Some(StagedWriteType(w)),
                user_errors: vec![],
            }),
            Err(e) => Ok(ApproveApplicantRegistrationPayload {
                staged_write: None,
                user_errors: vec![UserError::from_onboarding(&e, "")],
            }),
        }
    }

    /// Mints a session for a landed applicant. Callable repeatedly while
    /// the applicant token is valid — the token is the secret; a
    /// userError (BAD_INPUT) reports an application that has not landed
    /// yet.
    async fn claim_landed_session(
        &self,
        ctx: &Context<'_>,
        input: ClaimLandedSessionInput,
    ) -> async_graphql::Result<ClaimLandedSessionPayload> {
        let pool = ctx.data::<PgPool>()?;
        let auth_cfg = ctx.data::<AuthConfig>()?;
        match onboarding::claim_landed_session(
            pool,
            auth_cfg,
            &input.applicant_token,
            input.device_label.as_deref(),
        )
        .await
        {
            Ok(issued) => Ok(ClaimLandedSessionPayload {
                auth: Some(AuthSession::from_issued(issued)),
                user_errors: vec![],
            }),
            Err(e) => Ok(ClaimLandedSessionPayload {
                auth: None,
                user_errors: vec![UserError::from_onboarding(&e, "")],
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
        let refused = || {
            Ok(LogInPayload {
                auth: None,
                user_errors: vec![UserError::new(
                    ErrorCode::InvalidCredentials,
                    "email / password pair did not match",
                )],
            })
        };
        let Ok(email) = auth::normalize_email(&input.email) else {
            return refused();
        };
        let Some(credentials) = store::credentials_by_email(pool, &email).await? else {
            // Hash anyway so a missing account costs the same time as a
            // wrong password.
            let _ = auth::verify_password(
                "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                &input.password,
            );
            return refused();
        };
        if !auth::verify_password(&credentials.password_hash, &input.password) {
            return refused();
        }
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
            user_errors: vec![],
        })
    }

    /// A rotated session; `auth` is null with a REFRESH_TOKEN_INVALID
    /// userError when the refresh token is invalid, expired, or was
    /// already rotated (reuse) — a reuse-detected token also revokes
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
        let revoked = store::revoke_sessions(pool, v.user_id, Some(v.session_id)).await?;
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
        if let Ok(email) = auth::normalize_email(&input.email)
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
            mailer
                .send(Mail {
                    to: email,
                    subject: "Reset your CoGra password".into(),
                    body: format!(
                        "Your password-reset token (valid {PASSWORD_RESET_TTL_MINUTES} minutes): {}",
                        secret.token
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
        if let Err(m) = auth::check_password(&input.new_password) {
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
                    ErrorCode::VerificationTokenInvalid,
                    "reset token invalid, expired, or used",
                    vec!["resetToken".to_string()],
                )],
            });
        };
        let hash = auth::hash_password(&input.new_password)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        store::update_password_hash(pool, user_id, &hash).await?;
        store::revoke_sessions(pool, user_id, None).await?;
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
        if let Err(m) = auth::check_password(&input.new_password) {
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
        store::revoke_sessions(pool, v.user_id, Some(v.session_id)).await?;
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
    /// new-address verification have been confirmed.
    async fn confirm_email_change(
        &self,
        ctx: &Context<'_>,
        input: ConfirmEmailChangeInput,
    ) -> async_graphql::Result<ConfirmEmailChangePayload> {
        let v = viewer(ctx)?;
        let pool = ctx.data::<PgPool>()?;
        let hash = auth::hash_of(&input.code);
        // Either side's proof may arrive first; the change applies only
        // once both stand.
        let matched = store::confirm_email_change_new_side(pool, &hash)
            .await?
            .is_some()
            || store::confirm_email_change_original_side(pool, v.user_id, &hash).await?;
        if !matched {
            return Ok(ConfirmEmailChangePayload {
                user: None,
                user_errors: vec![UserError::at(
                    ErrorCode::VerificationTokenInvalid,
                    "code invalid, expired, or already used",
                    vec!["code".to_string()],
                )],
            });
        }
        store::apply_email_change_if_complete(pool, v.user_id).await?;
        let user = store::actor_identity(pool, v.user_id)
            .await?
            .map(|identity| User::from_viewer(identity, v));
        Ok(ConfirmEmailChangePayload {
            user,
            user_errors: vec![],
        })
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

    /// Upload (or replace) the client-encrypted key-backup blob —
    /// ciphertext under the device-generated recovery code; the server
    /// stores what it cannot decrypt. Retrieval is the `User.keyBackup`
    /// field: login + code is the recovery.
    async fn upload_key_backup(
        &self,
        ctx: &Context<'_>,
        input: UploadKeyBackupInput,
    ) -> async_graphql::Result<UploadKeyBackupPayload> {
        let v = viewer(ctx)?;
        let pool = ctx.data::<PgPool>()?;
        let blob = match decode_b64("blob", &input.blob) {
            Ok(b) => b,
            Err(e) => {
                return Ok(UploadKeyBackupPayload {
                    ok: None,
                    user_errors: vec![e],
                });
            }
        };
        store::upload_key_backup(pool, v.user_id, &blob).await?;
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
        let v = viewer(ctx)?;
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
        let v = viewer(ctx)?;
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
        let v = viewer(ctx)?;
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

    /// Relays the pre-signed proposals to L1's seal round trip. When the
    /// seal returns synchronously the payload's staged writes are
    /// already AWAITING_APPROVAL, verified act included. Verification
    /// failures surface as SIGNATURE_INVALID userErrors per proposal.
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
        let mut writes = Vec::with_capacity(input.proposals.len());
        let mut user_errors = Vec::new();
        for (i, proposal) in input.proposals.iter().enumerate() {
            let owned = match staged::load(pool, proposal.staged_write_id).await {
                Ok(w) if w.staged_by == StagedBy::Actor(v.user_id) => w,
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
                    author_pubkey: identity.actor_pubkey.clone(),
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
                Ok(w) if w.staged_by == StagedBy::Actor(v.user_id) => w,
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

/// The applicant's own view resolver shares this with the query root.
pub async fn application_view(
    ctx: &Context<'_>,
    applicant_token: &str,
) -> async_graphql::Result<Option<ApplicationView>> {
    let pool = ctx.data::<PgPool>()?;
    let boundary = ctx.data::<StandInBoundary>()?;
    let funding = ctx.data::<StandIn>()?;
    let cfg = ctx.data::<OnboardingConfig>()?;
    let applicant = match onboarding::applicant_by_token(pool, applicant_token).await {
        Ok(a) => a,
        Err(OnboardingError::Unauthenticated) => return Ok(None),
        Err(e) => return Err(async_graphql::Error::new(e.to_string())),
    };
    let staged_registration =
        match onboarding::staged_registration(pool, boundary, funding, cfg, &applicant).await {
            Ok(w) => w,
            Err(e) => {
                tracing::error!(error = %e, "staged-registration repair failed");
                None
            }
        };
    Ok(Some(ApplicationView {
        applicant,
        staged_registration,
    }))
}
