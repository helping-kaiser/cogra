//! The Postgres half of the genesis bootstrap — the genesis User's
//! credential + profile rows and the **first invite link**.
//!
//! That first link is minted here, by the bootstrap, not through the GraphQL
//! `register` / `createInviteLink` path: there is no prior account to issue
//! it, so the bootstrap seeds the one link the first real user registers
//! through (api-spec.md flags this as the bootstrap's exception). All three
//! writes take `&mut PgConnection` so they share the bootstrap transaction.

use chrono::{DateTime, Utc};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

/// True once the genesis `users` row exists. The bootstrap pairs this with the
/// graph `:Network` singleton: an instance is fully bootstrapped only when
/// *both* stores carry their genesis writes, so a half-failed run (graph
/// committed, Postgres not) re-runs instead of no-opping. Keyed on the genesis
/// User id read back from the graph — the cross-store join key.
pub async fn genesis_present(pool: &PgPool, user_id: Uuid) -> Result<bool, sqlx::Error> {
    // `EXISTS` is non-null, but sqlx infers it nullable; `!` fixes it to `bool`.
    sqlx::query_scalar!(
        r#"SELECT EXISTS (SELECT 1 FROM users WHERE id = $1) AS "exists!""#,
        user_id
    )
    .fetch_one(pool)
    .await
}

/// The id of the genesis User's first invite link — the earliest invitation
/// they own. Lets a re-run re-print the existing capability rather than mint a
/// second one. `None` if the genesis User has no invitation yet.
pub async fn genesis_invitation_id(
    pool: &PgPool,
    inviter_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar!(
        "SELECT id FROM auth_invitations
         WHERE inviter_id = $1
         ORDER BY created_at ASC, id ASC
         LIMIT 1",
        inviter_id
    )
    .fetch_optional(pool)
    .await
}

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
    // `ON CONFLICT (id) DO NOTHING` is defense-in-depth — the both-stores gate
    // already prevents re-running the genesis writes against a present row.
    sqlx::query!(
        "INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING",
        id,
        username,
        email,
        password_hash
    )
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
    sqlx::query!(
        "INSERT INTO user_profile_versions (user_id, display_name) VALUES ($1, $2)",
        user_id,
        display_name
    )
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
    sqlx::query_scalar!(
        "INSERT INTO auth_invitations
             (inviter_id, inviter_type, inviter_dim1, inviter_dim2, single_use, expires_at)
         VALUES ($1, 'user', $2, $3, FALSE, $4)
         RETURNING id",
        inviter_id,
        inviter_dim1,
        inviter_dim2,
        expires_at
    )
    .fetch_one(conn)
    .await
}
