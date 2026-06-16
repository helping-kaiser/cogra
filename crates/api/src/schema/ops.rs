//! Auth/account resolver logic, kept out of the `Mutation` root so the root
//! reads as an index. Each function consumes the flows specified in
//! [auth.md](../../../docs/implementation/auth.md) and
//! [architecture.md](../../../docs/implementation/architecture.md).

use std::sync::Arc;

use async_graphql::{Context, Error, Result};
use chrono::{Duration, Utc};
use common::wallet::placeholder_address;
use graph_engine::Graph;
use graph_engine::accounts::{InvitationEdges, create_registrant};
use postgres_store::PgPool;
use postgres_store::auth::{self, NewPendingRegistration};
use uuid::Uuid;

use crate::auth::jwt::JwtKeys;
use crate::auth::{password, tokens};
use crate::schema::types::{
    LogInInput, RefreshSessionInput, RegisterInput, RegisterPayload, Session, VerifyEmailInput,
};
use crate::schema::user::{AuthPayload, User};

/// Pending-registration lifetime (auth.md): unverified records expire in 24 h.
const PENDING_TTL_HOURS: i64 = 24;
/// Refresh-token lifetime (auth.md): 30 days, slid forward on each use.
const REFRESH_TTL_DAYS: i64 = 30;
/// The default invitation-edge value when a party skips the choice
/// (invitations.md "Default values").
const INVITE_EDGE_DEFAULT: f32 = 0.5;

/// Logs an internal failure with detail and returns a generic message — the
/// detail never leaks to the client.
pub(crate) fn internal(context: &str, err: impl std::fmt::Display) -> Error {
    tracing::error!(error = %err, context, "auth internal error");
    Error::new(format!("internal error: {context}"))
}

fn pool<'c>(ctx: &Context<'c>) -> Result<&'c PgPool> {
    ctx.data::<PgPool>()
}
fn graph<'c>(ctx: &Context<'c>) -> Result<&'c Graph> {
    ctx.data::<Graph>()
}
fn keys<'c>(ctx: &Context<'c>) -> Result<&'c Arc<JwtKeys>> {
    ctx.data::<Arc<JwtKeys>>()
}

/// `register` — submit through an invite link. Writes the off-graph pending
/// record and (until a mailer is wired) surfaces the verification token via
/// the log. No User node or session exists until `verifyEmail`.
pub async fn register(ctx: &Context<'_>, input: RegisterInput) -> Result<RegisterPayload> {
    let pool = pool(ctx)?;

    // Hash first so a too-short password is rejected before any DB work.
    let password_hash =
        password::hash_password(&input.password).map_err(|e| Error::new(e.to_string()))?;

    let now = Utc::now();
    let Some(invitation) = auth::find_invitation(pool, input.invite_link)
        .await
        .map_err(|e| internal("looking up invitation", e))?
    else {
        return Err(Error::new("invalid or unknown invite link"));
    };
    let consumed = invitation.single_use && invitation.consumed_at.is_some();
    if invitation.revoked_at.is_some() || invitation.expires_at < now || consumed {
        return Err(Error::new("this invite link is no longer valid"));
    }

    let dim1 = input
        .dim1
        .map(|d| d.0 as f32)
        .unwrap_or(INVITE_EDGE_DEFAULT);
    let dim2 = input
        .dim2
        .map(|d| d.0 as f32)
        .unwrap_or(INVITE_EDGE_DEFAULT);
    let token = tokens::generate();
    let expires_at = now + Duration::hours(PENDING_TTL_HOURS);

    let written = auth::upsert_pending_registration(
        pool,
        NewPendingRegistration {
            username: &input.handle,
            email: &input.email,
            password_hash: &password_hash,
            invitation_id: invitation.id,
            invitee_dim1: dim1,
            invitee_dim2: dim2,
            email_verification_token_hash: &token.hash,
            expires_at,
        },
    )
    .await
    .map_err(|e| internal("writing pending registration", e))?;

    match written {
        None => Err(Error::new(
            "a registration for this email is already in progress — check your email",
        )),
        Some(expires_at) => {
            // DEV-mode email-verification bypass (roadmap slice 0): no mail
            // server is wired yet, so the verification token is surfaced to
            // the operator via the log. Real sending replaces this later.
            tracing::warn!(
                target: "cogra::auth::dev",
                verification_token = %token.raw,
                email = %input.email,
                "DEV bypass — pass this verification token to verifyEmail (no mailer yet; auth.md)",
            );
            Ok(RegisterPayload { expires_at })
        }
    }
}

/// `verifyEmail` — the registration dual-store transaction
/// (architecture.md "User registration"). Atomically creates the `:User`
/// node, its `:Wallet` + `:PAYS_TO`, the two invitation edges, the verified
/// `users` row, the first profile version, and the first session; then
/// deletes the pending record. The graph commits first (idempotent on retry
/// via `MERGE`), Postgres second.
pub async fn verify_email(ctx: &Context<'_>, input: VerifyEmailInput) -> Result<AuthPayload> {
    let pool = pool(ctx)?;
    let graph = graph(ctx)?;
    let keys = keys(ctx)?;

    let token_hash = tokens::hash(&input.verification_token);
    let Some(pending) = auth::find_pending_by_token_hash(pool, &token_hash)
        .await
        .map_err(|e| internal("looking up pending registration", e))?
    else {
        return Err(Error::new("invalid or expired verification token"));
    };
    let now = Utc::now();
    if pending.expires_at < now {
        return Err(Error::new(
            "this verification link has expired — please register again",
        ));
    }
    let Some(invitation) = auth::find_invitation(pool, pending.invitation_id)
        .await
        .map_err(|e| internal("looking up invitation", e))?
    else {
        return Err(internal("invitation row vanished", "no row"));
    };

    let user_id = Uuid::new_v4();
    let wallet_id = Uuid::new_v4();
    let wallet_address = placeholder_address(wallet_id);
    let session_id = Uuid::new_v4();
    let refresh = tokens::generate();
    let refresh_expires = now + Duration::days(REFRESH_TTL_DAYS);

    // Held-open dual transaction: any failure before the commits drops both
    // handles, rolling each back. The graph write uses MERGE on the node
    // UUIDs, so a retry after a committed graph write is a no-op.
    let mut gtx = graph
        .start_txn()
        .await
        .map_err(|e| internal("opening graph transaction", e))?;
    create_registrant(
        &mut gtx,
        user_id,
        &pending.username,
        wallet_id,
        &wallet_address,
        &InvitationEdges {
            inviter_id: invitation.inviter_id,
            inviter_dim1: invitation.inviter_dim1 as f64,
            inviter_dim2: invitation.inviter_dim2 as f64,
            invitee_dim1: pending.invitee_dim1 as f64,
            invitee_dim2: pending.invitee_dim2 as f64,
        },
    )
    .await
    .map_err(|e| internal("writing account topology", e))?;

    let mut ptx = pool
        .begin()
        .await
        .map_err(|e| internal("opening Postgres transaction", e))?;
    auth::insert_user(
        &mut ptx,
        user_id,
        &pending.username,
        &pending.email,
        &pending.password_hash,
    )
    .await
    .map_err(|e| internal("inserting user", e))?;
    auth::insert_user_profile(&mut ptx, user_id, &pending.username)
        .await
        .map_err(|e| internal("inserting profile", e))?;
    let session_row = auth::insert_refresh_token(
        &mut ptx,
        session_id,
        user_id,
        &refresh.hash,
        refresh_expires,
        input.device_label.as_deref(),
    )
    .await
    .map_err(|e| internal("inserting session", e))?;
    auth::consume_invitation_if_single_use(&mut ptx, invitation.id)
        .await
        .map_err(|e| internal("consuming invitation", e))?;
    auth::delete_pending_registration(&mut ptx, pending.id)
        .await
        .map_err(|e| internal("deleting pending registration", e))?;

    // Commit graph first: a crash between the two commits leaves at worst an
    // unreachable orphan graph node (no users row to log in against), which is
    // the benign side of the inter-commit window (architecture.md
    // "Partial-failure handling").
    gtx.commit()
        .await
        .map_err(|e| internal("committing graph transaction", e))?;
    ptx.commit()
        .await
        .map_err(|e| internal("committing Postgres transaction", e))?;

    let access = keys
        .mint_access(user_id, session_id)
        .map_err(|e| internal("minting access token", e))?;
    let user = User::load(pool, graph, user_id)
        .await?
        .ok_or_else(|| internal("user not readable after creation", "load returned none"))?;

    Ok(AuthPayload {
        access_token: access,
        refresh_token: refresh.raw,
        session: Session::issued(session_row),
        user,
    })
}

/// `logIn` — verify credentials, issue a new session. A non-existent account
/// still runs a verification against a dummy hash so response timing does not
/// reveal which emails exist.
pub async fn log_in(ctx: &Context<'_>, input: LogInInput) -> Result<AuthPayload> {
    let pool = pool(ctx)?;
    let graph = graph(ctx)?;
    let keys = keys(ctx)?;

    let creds = auth::find_credentials_by_email(pool, &input.email)
        .await
        .map_err(|e| internal("looking up credentials", e))?;
    let user_id = match creds {
        Some(c) if password::verify_password(&c.password_hash, &input.password) => c.id,
        Some(_) => return Err(Error::new("invalid email or password")),
        None => {
            password::dummy_verify(&input.password);
            return Err(Error::new("invalid email or password"));
        }
    };

    let session_id = Uuid::new_v4();
    let refresh = tokens::generate();
    let refresh_expires = Utc::now() + Duration::days(REFRESH_TTL_DAYS);
    let mut conn = pool
        .acquire()
        .await
        .map_err(|e| internal("acquiring connection", e))?;
    let session_row = auth::insert_refresh_token(
        &mut conn,
        session_id,
        user_id,
        &refresh.hash,
        refresh_expires,
        input.device_label.as_deref(),
    )
    .await
    .map_err(|e| internal("inserting session", e))?;

    let access = keys
        .mint_access(user_id, session_id)
        .map_err(|e| internal("minting access token", e))?;
    let user = User::load(pool, graph, user_id)
        .await?
        .ok_or_else(|| internal("user not readable after login", "load returned none"))?;

    Ok(AuthPayload {
        access_token: access,
        refresh_token: refresh.raw,
        session: Session::issued(session_row),
        user,
    })
}

/// `refreshSession` — rotate the refresh token, mint a fresh access token.
/// Presenting an already-revoked token is treated as theft: every session is
/// revoked (auth.md "Reuse detection").
pub async fn refresh_session(ctx: &Context<'_>, input: RefreshSessionInput) -> Result<AuthPayload> {
    let pool = pool(ctx)?;
    let graph = graph(ctx)?;
    let keys = keys(ctx)?;

    let presented_hash = tokens::hash(&input.refresh_token);
    let Some(token) = auth::find_refresh_token_by_hash(pool, &presented_hash)
        .await
        .map_err(|e| internal("looking up refresh token", e))?
    else {
        return Err(Error::new("invalid refresh token"));
    };

    if token.revoked_at.is_some() {
        auth::revoke_all_sessions(pool, token.user_id)
            .await
            .map_err(|e| internal("revoking sessions on reuse", e))?;
        tracing::warn!(user_id = %token.user_id, "refresh-token reuse detected — all sessions revoked");
        return Err(Error::new(
            "refresh token reuse detected — all sessions revoked, please log in again",
        ));
    }
    let now = Utc::now();
    if token.expires_at < now {
        return Err(Error::new("refresh token expired — please log in again"));
    }

    let new_id = Uuid::new_v4();
    let new_refresh = tokens::generate();
    let new_expires = now + Duration::days(REFRESH_TTL_DAYS);
    let session_row = auth::rotate_refresh_token(
        pool,
        token.id,
        new_id,
        token.user_id,
        &new_refresh.hash,
        new_expires,
        token.device_label.as_deref(),
    )
    .await
    .map_err(|e| internal("rotating refresh token", e))?;

    let access = keys
        .mint_access(token.user_id, new_id)
        .map_err(|e| internal("minting access token", e))?;
    let user = User::load(pool, graph, token.user_id)
        .await?
        .ok_or_else(|| internal("user not readable after refresh", "load returned none"))?;

    Ok(AuthPayload {
        access_token: access,
        refresh_token: new_refresh.raw,
        session: Session::issued(session_row),
        user,
    })
}
