// Authentication and onboarding state (auth.md; data-model.md
// "Authentication state"): invite links, staged applicants, credentials,
// refresh-token sessions, and key backups. Auth gates the service, never
// the graph — nothing in this module is authoritative about any record.

use chrono::{DateTime, Utc};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

/// One invite link (data-model.md `auth_invite_links`): pure service-side
/// staging UX — nothing binds until the inviter's priced approval.
#[derive(Debug, Clone)]
pub struct InviteLink {
    pub id: Uuid,
    pub inviter_id: Uuid,
    pub prefill_p_d: f64,
    pub prefill_p_i: f64,
    pub single_use: bool,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
}

/// One staged applicant (data-model.md `auth_applicants`): everything
/// CoGra knows about a person between following a link and landing.
#[derive(Debug, Clone)]
pub struct Applicant {
    pub id: Uuid,
    pub invite_link_id: Uuid,
    pub handle: String,
    pub email: String,
    pub password_hash: String,
    pub email_verified_at: Option<DateTime<Utc>>,
    pub actor_pubkey: Vec<u8>,
    pub l0_address: String,
    pub approved_at: Option<DateTime<Utc>>,
    pub landed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// One refresh-token session row (auth.md "Sessions").
#[derive(Debug, Clone)]
pub struct Session {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
    pub device_label: Option<String>,
    pub revoked_at: Option<DateTime<Utc>>,
}

/// The login half of an account.
#[derive(Debug, Clone)]
pub struct Credentials {
    pub actor_id: Uuid,
    pub email: String,
    pub password_hash: String,
}

// ---------------------------------------------------------------------
// Invite links
// ---------------------------------------------------------------------

pub async fn create_invite_link(
    pool: &PgPool,
    id: Uuid,
    inviter_id: Uuid,
    prefill_p_d: f64,
    prefill_p_i: f64,
    single_use: bool,
    expires_at: DateTime<Utc>,
) -> Result<InviteLink, sqlx::Error> {
    sqlx::query!(
        "INSERT INTO auth_invite_links
             (id, inviter_id, prefill_dim1, prefill_dim2, single_use, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)",
        id,
        inviter_id,
        prefill_p_d as f32,
        prefill_p_i as f32,
        single_use,
        expires_at,
    )
    .execute(pool)
    .await?;
    invite_link(pool, id).await?.ok_or(sqlx::Error::RowNotFound)
}

pub async fn invite_link(pool: &PgPool, id: Uuid) -> Result<Option<InviteLink>, sqlx::Error> {
    Ok(sqlx::query!(
        "SELECT id, inviter_id, prefill_dim1, prefill_dim2, single_use,
                created_at, expires_at, revoked_at
         FROM auth_invite_links WHERE id = $1",
        id,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| InviteLink {
        id: r.id,
        inviter_id: r.inviter_id,
        prefill_p_d: f64::from(r.prefill_dim1),
        prefill_p_i: f64::from(r.prefill_dim2),
        single_use: r.single_use,
        created_at: r.created_at,
        expires_at: r.expires_at,
        revoked_at: r.revoked_at,
    }))
}

pub async fn invite_links_for(
    pool: &PgPool,
    inviter_id: Uuid,
) -> Result<Vec<InviteLink>, sqlx::Error> {
    Ok(sqlx::query!(
        "SELECT id, inviter_id, prefill_dim1, prefill_dim2, single_use,
                created_at, expires_at, revoked_at
         FROM auth_invite_links WHERE inviter_id = $1
         ORDER BY created_at DESC",
        inviter_id,
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| InviteLink {
        id: r.id,
        inviter_id: r.inviter_id,
        prefill_p_d: f64::from(r.prefill_dim1),
        prefill_p_i: f64::from(r.prefill_dim2),
        single_use: r.single_use,
        created_at: r.created_at,
        expires_at: r.expires_at,
        revoked_at: r.revoked_at,
    })
    .collect())
}

/// Revokes the issuer's own link; false when the link is not theirs (or
/// does not exist).
pub async fn revoke_invite_link(
    pool: &PgPool,
    id: Uuid,
    inviter_id: Uuid,
) -> Result<bool, sqlx::Error> {
    Ok(sqlx::query!(
        "UPDATE auth_invite_links SET revoked_at = NOW()
         WHERE id = $1 AND inviter_id = $2 AND revoked_at IS NULL",
        id,
        inviter_id,
    )
    .execute(pool)
    .await?
    .rows_affected()
        == 1)
}

/// Whether the link can stage a new applicant now: live, and — for a
/// single-use link — its one slot not already held by a live, approved,
/// or landed application (invitations.md §4 "Link modes").
pub async fn invite_link_usable(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT EXISTS(
               SELECT 1 FROM auth_invite_links l
               WHERE l.id = $1
                 AND l.revoked_at IS NULL
                 AND l.expires_at > NOW()
                 AND (NOT l.single_use OR NOT EXISTS(
                     SELECT 1 FROM auth_applicants a
                     WHERE a.invite_link_id = l.id
                       AND (a.expires_at > NOW()
                            OR a.approved_at IS NOT NULL
                            OR a.landed_at IS NOT NULL)
                 ))
           ) AS "usable!""#,
        id,
    )
    .fetch_one(pool)
    .await
}

// ---------------------------------------------------------------------
// Applicants
// ---------------------------------------------------------------------

/// The outcome of an application submit against the email constraint
/// (auth.md "Re-registration collision").
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubmitOutcome {
    Created,
    /// A live application (or a landed account's row) already holds the
    /// email.
    EmailHeld,
}

#[allow(clippy::too_many_arguments)]
pub async fn submit_applicant(
    pool: &PgPool,
    id: Uuid,
    invite_link_id: Uuid,
    handle: &str,
    email: &str,
    password_hash: &str,
    verification_token_hash: &[u8],
    applicant_token_hash: &[u8],
    actor_pubkey: &[u8],
    l0_address: &str,
    expires_at: DateTime<Utc>,
) -> Result<SubmitOutcome, sqlx::Error> {
    // An expired-but-unswept row is overwritten so the experience never
    // depends on the reaper's schedule; approved or landed rows are never
    // overwritten.
    let rows = sqlx::query!(
        "INSERT INTO auth_applicants
             (id, invite_link_id, handle, email, password_hash,
              email_verification_token_hash, applicant_token_hash,
              actor_pubkey, l0_address, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (email) DO UPDATE SET
             id = EXCLUDED.id,
             invite_link_id = EXCLUDED.invite_link_id,
             handle = EXCLUDED.handle,
             password_hash = EXCLUDED.password_hash,
             email_verification_token_hash = EXCLUDED.email_verification_token_hash,
             applicant_token_hash = EXCLUDED.applicant_token_hash,
             actor_pubkey = EXCLUDED.actor_pubkey,
             l0_address = EXCLUDED.l0_address,
             email_verified_at = NULL,
             created_at = NOW(),
             expires_at = EXCLUDED.expires_at
         WHERE auth_applicants.expires_at < NOW()
           AND auth_applicants.approved_at IS NULL
           AND auth_applicants.landed_at IS NULL",
        id,
        invite_link_id,
        handle,
        email,
        password_hash,
        verification_token_hash,
        applicant_token_hash,
        actor_pubkey,
        l0_address,
        expires_at,
    )
    .execute(pool)
    .await?
    .rows_affected();
    Ok(if rows == 1 {
        SubmitOutcome::Created
    } else {
        SubmitOutcome::EmailHeld
    })
}

/// Maps one applicant row (a sqlx anonymous record) onto the struct —
/// the queries all select the same field set.
macro_rules! applicant_from_row {
    ($r:expr) => {
        Applicant {
            id: $r.id,
            invite_link_id: $r.invite_link_id,
            handle: $r.handle,
            email: $r.email,
            password_hash: $r.password_hash,
            email_verified_at: $r.email_verified_at,
            actor_pubkey: $r.actor_pubkey,
            l0_address: $r.l0_address,
            approved_at: $r.approved_at,
            landed_at: $r.landed_at,
            created_at: $r.created_at,
            expires_at: $r.expires_at,
        }
    };
}

pub async fn applicant(pool: &PgPool, id: Uuid) -> Result<Option<Applicant>, sqlx::Error> {
    Ok(sqlx::query!(
        "SELECT id, invite_link_id, handle, email, password_hash,
                email_verified_at, actor_pubkey, l0_address,
                approved_at, landed_at, created_at, expires_at
         FROM auth_applicants WHERE id = $1",
        id,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| applicant_from_row!(r)))
}

/// The applicant-token lookup — the sole authorization of the applicant's
/// own flow (status polling, registration signing, the session claim).
pub async fn applicant_by_token_hash(
    pool: &PgPool,
    token_hash: &[u8],
) -> Result<Option<Applicant>, sqlx::Error> {
    Ok(sqlx::query!(
        "SELECT id, invite_link_id, handle, email, password_hash,
                email_verified_at, actor_pubkey, l0_address,
                approved_at, landed_at, created_at, expires_at
         FROM auth_applicants WHERE applicant_token_hash = $1",
        token_hash,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| applicant_from_row!(r)))
}

/// The inviter's approval queue for one link, newest first.
pub async fn applicants_for_link(
    pool: &PgPool,
    invite_link_id: Uuid,
) -> Result<Vec<Applicant>, sqlx::Error> {
    Ok(sqlx::query!(
        "SELECT id, invite_link_id, handle, email, password_hash,
                email_verified_at, actor_pubkey, l0_address,
                approved_at, landed_at, created_at, expires_at
         FROM auth_applicants WHERE invite_link_id = $1
         ORDER BY created_at DESC",
        invite_link_id,
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| applicant_from_row!(r))
    .collect())
}

/// Marks the email channel proven and extends the application's life to
/// its link's expiry — a verified applicant persists while the link lives
/// (auth.md "Application"; the upsert predicate reads `expires_at`, so
/// the extension is what protects a verified row from being overwritten).
pub async fn verify_applicant_email(
    pool: &PgPool,
    verification_token_hash: &[u8],
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar!(
        "UPDATE auth_applicants a
         SET email_verified_at = NOW(),
             expires_at = l.expires_at
         FROM auth_invite_links l
         WHERE a.invite_link_id = l.id
           AND a.email_verification_token_hash = $1
           AND a.email_verified_at IS NULL
           AND a.expires_at > NOW()
         RETURNING a.id",
        verification_token_hash,
    )
    .fetch_optional(pool)
    .await
}

/// The live, unverified applicant holding an email — the resend target.
pub async fn unverified_applicant_by_email(
    pool: &PgPool,
    email: &str,
) -> Result<Option<Applicant>, sqlx::Error> {
    Ok(sqlx::query!(
        "SELECT id, invite_link_id, handle, email, password_hash,
                email_verified_at, actor_pubkey, l0_address,
                approved_at, landed_at, created_at, expires_at
         FROM auth_applicants
         WHERE email = $1 AND email_verified_at IS NULL AND expires_at > NOW()",
        email,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| applicant_from_row!(r)))
}

/// Replaces the verification token for a resend — the raw token never
/// persists, so a resend mints a fresh secret.
pub async fn rotate_verification_token(
    pool: &PgPool,
    applicant_id: Uuid,
    new_token_hash: &[u8],
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE auth_applicants SET email_verification_token_hash = $2
         WHERE id = $1 AND email_verified_at IS NULL",
        applicant_id,
        new_token_hash,
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Marks the inviter's priced approval. Refused (None) unless the
/// application is live, email-verified, and not yet approved.
pub async fn approve_applicant(
    conn: &mut PgConnection,
    id: Uuid,
) -> Result<Option<Applicant>, sqlx::Error> {
    let approved = sqlx::query!(
        "UPDATE auth_applicants
         SET approved_at = NOW()
         WHERE id = $1
           AND approved_at IS NULL
           AND email_verified_at IS NOT NULL
           AND expires_at > NOW()
         RETURNING id, invite_link_id, handle, email, password_hash,
                   email_verified_at, actor_pubkey, l0_address,
                   approved_at, landed_at, created_at, expires_at",
        id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(approved.map(|r| applicant_from_row!(r)))
}

/// Lands an approved applicant whose Registration confirmed: creates the
/// actor row (the identity association), the credentials, and the first
/// profile version (display name = handle until the member edits), and
/// marks the applicant landed — one transaction (auth.md "Approval and
/// landing" step 4).
pub async fn land_applicant(
    conn: &mut PgConnection,
    applicant_id: Uuid,
    actor_id: Uuid,
) -> Result<(), sqlx::Error> {
    let row = sqlx::query!(
        "SELECT handle, email, password_hash, actor_pubkey, l0_address
         FROM auth_applicants
         WHERE id = $1 AND approved_at IS NOT NULL AND landed_at IS NULL",
        applicant_id,
    )
    .fetch_one(&mut *conn)
    .await?;
    sqlx::query!(
        "INSERT INTO actors (id, kind, handle, actor_pubkey, l0_address)
         VALUES ($1, 'user', $2, $3, $4)",
        actor_id,
        row.handle,
        row.actor_pubkey,
        row.l0_address,
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!(
        "INSERT INTO user_credentials (actor_id, email, password_hash)
         VALUES ($1, $2, $3)",
        actor_id,
        row.email,
        row.password_hash,
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!(
        "INSERT INTO actor_profile_versions (actor_id, display_name)
         VALUES ($1, $2)",
        actor_id,
        row.handle,
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!(
        "UPDATE auth_applicants SET landed_at = NOW(), actor_id = $2 WHERE id = $1",
        applicant_id,
        actor_id,
    )
    .execute(&mut *conn)
    .await?;
    Ok(())
}

/// The actor that issued the invite link this account's application came
/// through — landing provenance; None for actors without an application
/// trace (genesis actors).
pub async fn inviter_of(
    pool: &PgPool,
    actor_id: Uuid,
) -> Result<Option<ActorIdentity>, sqlx::Error> {
    Ok(sqlx::query!(
        "SELECT i.id, i.kind, i.handle, i.actor_pubkey, i.l0_address
         FROM auth_applicants a
         JOIN auth_invite_links l ON l.id = a.invite_link_id
         JOIN actors i ON i.id = l.inviter_id
         WHERE a.actor_id = $1",
        actor_id,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| ActorIdentity {
        id: r.id,
        kind: r.kind,
        handle: r.handle,
        actor_pubkey: r.actor_pubkey,
        l0_address: r.l0_address,
    }))
}

/// The reaper (auth.md "Account lifecycle"): deletes expired applications
/// that were never approved. Approved rows persist — their funding burn
/// happened; landed rows persist as the account's registration trace.
pub async fn reap_applicants(pool: &PgPool) -> Result<u64, sqlx::Error> {
    Ok(sqlx::query!(
        "DELETE FROM auth_applicants
         WHERE expires_at < NOW()
           AND approved_at IS NULL
           AND landed_at IS NULL",
    )
    .execute(pool)
    .await?
    .rows_affected())
}

/// Whether a handle can still be claimed: free in the one actor
/// namespace and not held by a live or in-flight application
/// (decision D7 — checked at submit and re-checked at approval).
pub async fn handle_available(pool: &PgPool, handle: &str) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT NOT EXISTS(SELECT 1 FROM actors WHERE handle = $1)
               AND NOT EXISTS(
                   SELECT 1 FROM auth_applicants
                   WHERE handle = $1
                     AND landed_at IS NULL
                     AND (expires_at > NOW() OR approved_at IS NOT NULL)
               ) AS "available!""#,
        handle,
    )
    .fetch_one(pool)
    .await
}

// ---------------------------------------------------------------------
// Credentials and sessions
// ---------------------------------------------------------------------

pub async fn credentials_by_email(
    pool: &PgPool,
    email: &str,
) -> Result<Option<Credentials>, sqlx::Error> {
    Ok(sqlx::query!(
        "SELECT actor_id, email, password_hash FROM user_credentials WHERE email = $1",
        email,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| Credentials {
        actor_id: r.actor_id,
        email: r.email,
        password_hash: r.password_hash,
    }))
}

pub async fn credentials_by_actor(
    pool: &PgPool,
    actor_id: Uuid,
) -> Result<Option<Credentials>, sqlx::Error> {
    Ok(sqlx::query!(
        "SELECT actor_id, email, password_hash FROM user_credentials WHERE actor_id = $1",
        actor_id,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| Credentials {
        actor_id: r.actor_id,
        email: r.email,
        password_hash: r.password_hash,
    }))
}

pub async fn update_password_hash(
    pool: &PgPool,
    actor_id: Uuid,
    password_hash: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE user_credentials SET password_hash = $2 WHERE actor_id = $1",
        actor_id,
        password_hash,
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Inserts a fresh session row (the raw token never persists — only its
/// hash; auth.md "Refresh token").
pub async fn insert_session(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
    token_hash: &[u8],
    expires_at: DateTime<Utc>,
    device_label: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO auth_refresh_tokens
             (id, user_id, token_hash, expires_at, device_label)
         VALUES ($1, $2, $3, $4, $5)",
        id,
        user_id,
        token_hash,
        expires_at,
        device_label,
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn session_by_token_hash(
    pool: &PgPool,
    token_hash: &[u8],
) -> Result<Option<Session>, sqlx::Error> {
    Ok(sqlx::query!(
        "SELECT id, user_id, created_at, last_used_at, expires_at,
                device_label, revoked_at
         FROM auth_refresh_tokens WHERE token_hash = $1",
        token_hash,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| Session {
        id: r.id,
        user_id: r.user_id,
        created_at: r.created_at,
        last_used_at: r.last_used_at,
        expires_at: r.expires_at,
        device_label: r.device_label,
        revoked_at: r.revoked_at,
    }))
}

pub async fn session(pool: &PgPool, id: Uuid) -> Result<Option<Session>, sqlx::Error> {
    Ok(sqlx::query!(
        "SELECT id, user_id, created_at, last_used_at, expires_at,
                device_label, revoked_at
         FROM auth_refresh_tokens WHERE id = $1",
        id,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| Session {
        id: r.id,
        user_id: r.user_id,
        created_at: r.created_at,
        last_used_at: r.last_used_at,
        expires_at: r.expires_at,
        device_label: r.device_label,
        revoked_at: r.revoked_at,
    }))
}

/// Rotation (auth.md "Refresh token"): consumes the presented row and
/// mints its successor in one transaction — every successful refresh
/// invalidates the old token, bounding a stolen token to a single use.
pub async fn rotate_session(
    pool: &PgPool,
    old_id: Uuid,
    new_id: Uuid,
    new_token_hash: &[u8],
    new_expires_at: DateTime<Utc>,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    let row = sqlx::query!(
        "UPDATE auth_refresh_tokens
         SET revoked_at = NOW(), last_used_at = NOW()
         WHERE id = $1 AND revoked_at IS NULL
         RETURNING user_id, device_label",
        old_id,
    )
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query!(
        "INSERT INTO auth_refresh_tokens
             (id, user_id, token_hash, expires_at, device_label)
         VALUES ($1, $2, $3, $4, $5)",
        new_id,
        row.user_id,
        new_token_hash,
        new_expires_at,
        row.device_label.as_deref(),
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// Active sessions for the session list — unexpired and unrevoked.
pub async fn sessions_for(pool: &PgPool, user_id: Uuid) -> Result<Vec<Session>, sqlx::Error> {
    Ok(sqlx::query!(
        "SELECT id, user_id, created_at, last_used_at, expires_at,
                device_label, revoked_at
         FROM auth_refresh_tokens
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC",
        user_id,
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| Session {
        id: r.id,
        user_id: r.user_id,
        created_at: r.created_at,
        last_used_at: r.last_used_at,
        expires_at: r.expires_at,
        device_label: r.device_label,
        revoked_at: r.revoked_at,
    })
    .collect())
}

/// Revokes one of the user's sessions; false when it is not theirs.
pub async fn revoke_session(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<bool, sqlx::Error> {
    Ok(sqlx::query!(
        "UPDATE auth_refresh_tokens SET revoked_at = NOW()
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL",
        id,
        user_id,
    )
    .execute(pool)
    .await?
    .rows_affected()
        == 1)
}

/// Revokes every session except `keep` (password change, "revoke all
/// others"). Pass None to revoke all (reset, reuse detection, deletion).
pub async fn revoke_sessions(
    pool: &PgPool,
    user_id: Uuid,
    keep: Option<Uuid>,
) -> Result<u64, sqlx::Error> {
    Ok(sqlx::query!(
        "UPDATE auth_refresh_tokens SET revoked_at = NOW()
         WHERE user_id = $1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR id <> $2)",
        user_id,
        keep,
    )
    .execute(pool)
    .await?
    .rows_affected())
}

// ---------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------

pub async fn create_password_reset(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
    token_hash: &[u8],
    expires_at: DateTime<Utc>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO auth_password_resets (id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)",
        id,
        user_id,
        token_hash,
        expires_at,
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Consumes a live reset token, returning its account. None when the
/// token is unknown, expired, or already used.
pub async fn consume_password_reset(
    pool: &PgPool,
    token_hash: &[u8],
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar!(
        "UPDATE auth_password_resets SET used_at = NOW()
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
         RETURNING user_id",
        token_hash,
    )
    .fetch_optional(pool)
    .await
}

// ---------------------------------------------------------------------
// Email change (the two-sided proof — auth.md "Email change")
// ---------------------------------------------------------------------

pub async fn create_email_change(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
    new_email: &str,
    original_code_hash: &[u8],
    new_email_token_hash: &[u8],
    expires_at: DateTime<Utc>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO auth_email_changes
             (id, user_id, new_email, original_code_hash,
              new_email_token_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)",
        id,
        user_id,
        new_email,
        original_code_hash,
        new_email_token_hash,
        expires_at,
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Marks the new address verified via its link. Returns the change's
/// account when the token matched a live change.
pub async fn confirm_email_change_new_side(
    pool: &PgPool,
    new_email_token_hash: &[u8],
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar!(
        "UPDATE auth_email_changes SET new_verified_at = NOW()
         WHERE new_email_token_hash = $1 AND new_verified_at IS NULL
           AND expires_at > NOW()
         RETURNING user_id",
        new_email_token_hash,
    )
    .fetch_optional(pool)
    .await
}

/// Submits the original-address code, marking that side proven. Returns
/// whether a live change matched; the change applies via
/// `apply_email_change_if_complete`.
pub async fn confirm_email_change_original_side(
    pool: &PgPool,
    user_id: Uuid,
    original_code_hash: &[u8],
) -> Result<bool, sqlx::Error> {
    Ok(sqlx::query!(
        "UPDATE auth_email_changes SET original_confirmed_at = NOW()
         WHERE user_id = $1 AND original_code_hash = $2
           AND original_confirmed_at IS NULL AND expires_at > NOW()",
        user_id,
        original_code_hash,
    )
    .execute(pool)
    .await?
    .rows_affected()
        == 1)
}

/// Applies the account's newest fully-proven, unexpired email change —
/// `user_credentials.email` updates only when both sides hold (auth.md
/// "Email change"). Idempotent; true when the credentials row changed.
pub async fn apply_email_change_if_complete(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    Ok(sqlx::query!(
        "UPDATE user_credentials c
         SET email = ec.new_email
         FROM (
             SELECT new_email FROM auth_email_changes
             WHERE user_id = $1
               AND original_confirmed_at IS NOT NULL
               AND new_verified_at IS NOT NULL
               AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1
         ) ec
         WHERE c.actor_id = $1 AND c.email IS DISTINCT FROM ec.new_email",
        user_id,
    )
    .execute(pool)
    .await?
    .rows_affected()
        == 1)
}

// ---------------------------------------------------------------------
// Handle change and key backups
// ---------------------------------------------------------------------

/// Renames the account in the one actor namespace. False on a uniqueness
/// collision (surfaced as HANDLE_TAKEN).
pub async fn change_handle(
    pool: &PgPool,
    user_id: Uuid,
    handle: &str,
) -> Result<bool, sqlx::Error> {
    match sqlx::query!(
        "UPDATE actors SET handle = $2 WHERE id = $1 AND kind = 'user'",
        user_id,
        handle,
    )
    .execute(pool)
    .await
    {
        Ok(r) => Ok(r.rows_affected() == 1),
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => Ok(false),
        Err(e) => Err(e),
    }
}

/// Stores a client-encrypted key-backup blob — replacement appends, the
/// newest row is the current backup (data-model.md `auth_key_backups`).
pub async fn upload_key_backup(
    pool: &PgPool,
    user_id: Uuid,
    blob: &[u8],
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO auth_key_backups (user_id, blob) VALUES ($1, $2)",
        user_id,
        blob,
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn latest_key_backup(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Option<Vec<u8>>, sqlx::Error> {
    sqlx::query_scalar!(
        "SELECT blob FROM auth_key_backups WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 1",
        user_id,
    )
    .fetch_optional(pool)
    .await
}

// ---------------------------------------------------------------------
// Actor reads the auth flows need
// ---------------------------------------------------------------------

/// The identity association of one actor row.
#[derive(Debug, Clone)]
pub struct ActorIdentity {
    pub id: Uuid,
    pub kind: String,
    pub handle: String,
    pub actor_pubkey: Vec<u8>,
    pub l0_address: String,
}

/// The newest profile version's display name (data-model.md
/// "Display-content versioning" — newest row wins).
pub async fn current_display_name(
    pool: &PgPool,
    actor_id: Uuid,
) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar!(
        "SELECT display_name FROM actor_profile_versions
         WHERE actor_id = $1 ORDER BY created_at DESC LIMIT 1",
        actor_id,
    )
    .fetch_optional(pool)
    .await
}

pub async fn actor_identity(pool: &PgPool, id: Uuid) -> Result<Option<ActorIdentity>, sqlx::Error> {
    Ok(sqlx::query!(
        "SELECT id, kind, handle, actor_pubkey, l0_address FROM actors WHERE id = $1",
        id,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| ActorIdentity {
        id: r.id,
        kind: r.kind,
        handle: r.handle,
        actor_pubkey: r.actor_pubkey,
        l0_address: r.l0_address,
    }))
}
