//! Authentication state — the off-graph credential and session rows behind
//! [auth.md](../../../docs/implementation/auth.md): pending registrations,
//! invitations, the `users` credential row, and rotating refresh tokens.
//!
//! Transactional writes take `&mut PgConnection` so the service layer can
//! hold one Postgres transaction open alongside the Memgraph one and commit
//! them together (architecture.md "Service-layer transactions"). Standalone
//! reads and single-statement writes take `&PgPool`.

use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgConnection, PgPool};
use uuid::Uuid;

/// A live or expired pending registration — the off-graph record that exists
/// between `register` and `verifyEmail`. No `:User` node exists yet.
#[derive(Debug, FromRow)]
pub struct PendingRegistration {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub invitation_id: Uuid,
    pub invitee_dim1: f32,
    pub invitee_dim2: f32,
    pub expires_at: DateTime<Utc>,
}

/// An invite link's server-side row. The link URL carries only `id`; the
/// pre-committed inviter tensor stays here so relaying the link cannot tamper
/// with it (auth.md "Invitation generation").
#[derive(Debug, FromRow)]
pub struct Invitation {
    pub id: Uuid,
    pub inviter_id: Uuid,
    pub inviter_type: String,
    pub inviter_dim1: f32,
    pub inviter_dim2: f32,
    pub single_use: bool,
    pub consumed_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
}

/// The credentials needed to authenticate a login — never the whole row, and
/// never returned beyond the auth layer.
#[derive(Debug, FromRow)]
pub struct UserCredentials {
    pub id: Uuid,
    pub password_hash: String,
}

/// A session row in `auth_refresh_tokens` — the `token_hash` itself never
/// leaves the database (auth.md "Refresh token").
#[derive(Debug, FromRow)]
pub struct RefreshToken {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
    pub device_label: Option<String>,
    pub revoked_at: Option<DateTime<Utc>>,
}

/// The fields a `register` submit writes to a pending row.
pub struct NewPendingRegistration<'a> {
    pub username: &'a str,
    pub email: &'a str,
    pub password_hash: &'a str,
    pub invitation_id: Uuid,
    pub invitee_dim1: f32,
    pub invitee_dim2: f32,
    pub email_verification_token_hash: &'a [u8],
    pub expires_at: DateTime<Utc>,
}

/// Inserts a pending registration, or overwrites an **expired-but-unswept**
/// one for the same email. Returns the row's `expires_at`, or `None` when a
/// **live** pending row already holds the address — the
/// "registration in progress" path (auth.md "Re-registration collision").
/// The reaper, not this call, is the normal cleanup path.
pub async fn upsert_pending_registration(
    pool: &PgPool,
    reg: NewPendingRegistration<'_>,
) -> Result<Option<DateTime<Utc>>, sqlx::Error> {
    sqlx::query_scalar(
        "INSERT INTO auth_pending_registrations
             (username, email, password_hash, invitation_id, invitee_dim1,
              invitee_dim2, email_verification_token_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (email) DO UPDATE SET
             username = EXCLUDED.username,
             password_hash = EXCLUDED.password_hash,
             invitation_id = EXCLUDED.invitation_id,
             invitee_dim1 = EXCLUDED.invitee_dim1,
             invitee_dim2 = EXCLUDED.invitee_dim2,
             email_verification_token_hash = EXCLUDED.email_verification_token_hash,
             created_at = NOW(),
             expires_at = EXCLUDED.expires_at
         WHERE auth_pending_registrations.expires_at < NOW()
         RETURNING expires_at",
    )
    .bind(reg.username)
    .bind(reg.email)
    .bind(reg.password_hash)
    .bind(reg.invitation_id)
    .bind(reg.invitee_dim1)
    .bind(reg.invitee_dim2)
    .bind(reg.email_verification_token_hash)
    .bind(reg.expires_at)
    .fetch_optional(pool)
    .await
}

/// Looks up a pending registration by its verification-token hash. Expiry is
/// checked by the caller so it can distinguish "no such token" from "expired".
pub async fn find_pending_by_token_hash(
    pool: &PgPool,
    token_hash: &[u8],
) -> Result<Option<PendingRegistration>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, username, email, password_hash, invitation_id,
                invitee_dim1, invitee_dim2, expires_at
         FROM auth_pending_registrations
         WHERE email_verification_token_hash = $1",
    )
    .bind(token_hash)
    .fetch_optional(pool)
    .await
}

/// Reads an invitation row by id. Validity (unexpired / unrevoked /
/// unconsumed) is judged by the caller.
pub async fn find_invitation(pool: &PgPool, id: Uuid) -> Result<Option<Invitation>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, inviter_id, inviter_type, inviter_dim1, inviter_dim2,
                single_use, consumed_at, expires_at, revoked_at
         FROM auth_invitations WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

/// Finds a user's login credentials by email. `None` when no account exists —
/// the caller still runs a dummy verification to keep timing uniform.
pub async fn find_credentials_by_email(
    pool: &PgPool,
    email: &str,
) -> Result<Option<UserCredentials>, sqlx::Error> {
    sqlx::query_as("SELECT id, password_hash FROM users WHERE email = $1")
        .bind(email)
        .fetch_optional(pool)
        .await
}

/// Whether a verified account already holds this handle. Registration checks
/// this so a clash surfaces as the typed `HandleTaken` arm rather than a
/// unique-violation deep in `verifyEmail`. Pending registrations are not
/// consulted — they hold no committed handle and may expire — so a residual
/// two-pending race still resolves at `insert_user`.
pub async fn username_taken(pool: &PgPool, username: &str) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)")
        .bind(username)
        .fetch_one(pool)
        .await
}

/// Inserts the verified `users` row — credentials copied across from the
/// pending record (auth.md "Email verification"). Transactional.
pub async fn insert_user(
    conn: &mut PgConnection,
    id: Uuid,
    username: &str,
    email: &str,
    password_hash: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)")
        .bind(id)
        .bind(username)
        .bind(email)
        .bind(password_hash)
        .execute(conn)
        .await
        .map(|_| ())
}

/// Inserts the first display-content profile version. `display_name` seeds
/// to the handle at registration; the user edits it later via `editProfile`.
pub async fn insert_user_profile(
    conn: &mut PgConnection,
    user_id: Uuid,
    display_name: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO user_profile_versions (user_id, display_name) VALUES ($1, $2)")
        .bind(user_id)
        .bind(display_name)
        .execute(conn)
        .await
        .map(|_| ())
}

/// Issues a session row. The raw token never touches the database — only its
/// SHA-256 hash. Returns the row for the `Session` payload. Transactional.
pub async fn insert_refresh_token(
    conn: &mut PgConnection,
    id: Uuid,
    user_id: Uuid,
    token_hash: &[u8],
    expires_at: DateTime<Utc>,
    device_label: Option<&str>,
) -> Result<RefreshToken, sqlx::Error> {
    sqlx::query_as(
        "INSERT INTO auth_refresh_tokens (id, user_id, token_hash, expires_at, device_label)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, created_at, last_used_at, expires_at, device_label, revoked_at",
    )
    .bind(id)
    .bind(user_id)
    .bind(token_hash)
    .bind(expires_at)
    .bind(device_label)
    .fetch_one(conn)
    .await
}

/// Marks a single-use invitation consumed by its first accepted
/// registration. A no-op on a multi-use link. Transactional.
pub async fn consume_invitation_if_single_use(
    conn: &mut PgConnection,
    invitation_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE auth_invitations SET consumed_at = NOW()
         WHERE id = $1 AND single_use = TRUE AND consumed_at IS NULL",
    )
    .bind(invitation_id)
    .execute(conn)
    .await
    .map(|_| ())
}

/// Deletes the pending registration once its `:User` node is created.
/// Transactional.
pub async fn delete_pending_registration(
    conn: &mut PgConnection,
    id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM auth_pending_registrations WHERE id = $1")
        .bind(id)
        .execute(conn)
        .await
        .map(|_| ())
}

/// Looks up a session by its token hash for refresh / reuse-detection.
pub async fn find_refresh_token_by_hash(
    pool: &PgPool,
    token_hash: &[u8],
) -> Result<Option<RefreshToken>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, user_id, created_at, last_used_at, expires_at, device_label, revoked_at
         FROM auth_refresh_tokens WHERE token_hash = $1",
    )
    .bind(token_hash)
    .fetch_optional(pool)
    .await
}

/// Rotation: revokes the presented token and issues its replacement in one
/// transaction (auth.md "Rotation"). Returns the new session row. The new
/// token slides `expires_at` 30 days out from now; `device_label` carries
/// across so the session keeps its label through the rotation.
#[allow(clippy::too_many_arguments)]
pub async fn rotate_refresh_token(
    pool: &PgPool,
    old_id: Uuid,
    new_id: Uuid,
    user_id: Uuid,
    new_token_hash: &[u8],
    new_expires_at: DateTime<Utc>,
    device_label: Option<&str>,
) -> Result<RefreshToken, sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query(
        "UPDATE auth_refresh_tokens SET revoked_at = NOW(), last_used_at = NOW() WHERE id = $1",
    )
    .bind(old_id)
    .execute(&mut *tx)
    .await?;
    let row = insert_refresh_token(
        &mut tx,
        new_id,
        user_id,
        new_token_hash,
        new_expires_at,
        device_label,
    )
    .await?;
    tx.commit().await?;
    Ok(row)
}

/// Revokes every still-live session for a user — the response to refresh-token
/// reuse (auth.md "Reuse detection") and to security events.
pub async fn revoke_all_sessions(pool: &PgPool, user_id: Uuid) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        "UPDATE auth_refresh_tokens SET revoked_at = NOW()
         WHERE user_id = $1 AND revoked_at IS NULL",
    )
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}
