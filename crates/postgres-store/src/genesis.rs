//! The Postgres half of the genesis bootstrap — the genesis User's
//! credential + profile rows and the **first invite link**.
//!
//! That first link is minted here, by the bootstrap, not through the GraphQL
//! `register` / `createInviteLink` path: there is no prior account to issue
//! it, so the bootstrap seeds the one link the first real user registers
//! through (api-spec.md flags this as the bootstrap's exception). All three
//! writes take `&mut PgConnection` so they share the bootstrap transaction.

use chrono::{DateTime, Utc};
use sqlx::PgConnection;
use uuid::Uuid;

/// Inserts the genesis `users` row. Credentials are supplied to the bootstrap
/// at run time (auth.md "Account lifecycle" — the genesis User is the one
/// account that never passes through invitation).
pub async fn insert_genesis_user(
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

/// Inserts the genesis User's first profile version (`display_name` seeded to
/// the handle).
pub async fn insert_genesis_profile(
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

/// Seeds the first invite link — a multi-use, long-lived link owned by the
/// genesis User — and returns its id (the shareable capability). The
/// pre-committed inviter tensor follows the invitation default `(+0.5, +0.5)`.
pub async fn insert_genesis_invitation(
    conn: &mut PgConnection,
    inviter_id: Uuid,
    inviter_dim1: f32,
    inviter_dim2: f32,
    expires_at: DateTime<Utc>,
) -> Result<Uuid, sqlx::Error> {
    sqlx::query_scalar(
        "INSERT INTO auth_invitations
             (inviter_id, inviter_type, inviter_dim1, inviter_dim2, single_use, expires_at)
         VALUES ($1, 'user', $2, $3, FALSE, $4)
         RETURNING id",
    )
    .bind(inviter_id)
    .bind(inviter_dim1)
    .bind(inviter_dim2)
    .bind(expires_at)
    .fetch_one(conn)
    .await
}
