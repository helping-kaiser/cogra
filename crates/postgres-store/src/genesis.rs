// L2 genesis seeding — the CoGra-side half of the bootstrap
// (architecture.md "Genesis bootstrap"): the operator account's service
// rows, the system actors with their custodied keys, the reserved Type
// keys, and the overlay parameter carrier initialized from the Charter's
// genesis payload. The L1-side half (the genesis records) runs through
// the seam; the gate over both halves lives in api::bootstrap.

use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

/// The reserved system-actor handles (network.md §2 — system handles are
/// reserved at bootstrap; one namespace across kinds).
pub const PUBLISHER_HANDLE: &str = "publisher";
pub const MODERATOR_HANDLE: &str = "moderator";
pub const TREASURY_HANDLE: &str = "treasury";

/// The reserved Types seeded into the naming service (network.md §2):
/// moderation's verdict Types, the role Type, and bot-defense.
pub const RESERVED_TYPES: [&str; 4] = ["moderator", "illegal", "sensitive", "bot-defense"];

pub struct ActorRow {
    pub id: Uuid,
    pub kind: String,
    pub handle: String,
    pub actor_pubkey: Option<Vec<u8>>,
    pub l0_address: Option<String>,
}

/// The L2-half gate: the operator's service rows exist when every system
/// actor row stands (the Genesis Moderator's row is created alongside —
/// checked via its key custody being unnecessary: its handle is runtime
/// input, so the stable gate is the reserved system handles).
pub async fn system_actors_present(pool: &PgPool) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT COUNT(*) = 3 AS "all!" FROM actors
           WHERE kind = 'system'
             AND handle IN ($1, $2, $3)"#,
        PUBLISHER_HANDLE,
        MODERATOR_HANDLE,
        TREASURY_HANDLE,
    )
    .fetch_one(pool)
    .await
}

pub async fn actor_by_handle(pool: &PgPool, handle: &str) -> Result<Option<ActorRow>, sqlx::Error> {
    sqlx::query_as!(
        ActorRow,
        "SELECT id, kind, handle, actor_pubkey, l0_address FROM actors WHERE handle = $1",
        handle,
    )
    .fetch_optional(pool)
    .await
}

pub async fn insert_actor(
    conn: &mut PgConnection,
    id: Uuid,
    kind: &str,
    handle: &str,
    actor_pubkey: &[u8],
    l0_address: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO actors (id, kind, handle, actor_pubkey, l0_address)
         VALUES ($1, $2, $3, $4, $5)",
        id,
        kind,
        handle,
        actor_pubkey,
        l0_address,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn insert_profile_version(
    conn: &mut PgConnection,
    actor_id: Uuid,
    display_name: &str,
    bio: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO actor_profile_versions (actor_id, display_name, bio)
         VALUES ($1, $2, $3)",
        actor_id,
        display_name,
        bio,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Stores a system actor's custodied signing seed (substrate.md §8 —
/// backend custody by design).
pub async fn insert_system_key(
    conn: &mut PgConnection,
    actor_id: Uuid,
    signing_seed: &[u8],
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO system_actor_keys (actor_id, signing_seed) VALUES ($1, $2)",
        actor_id,
        signing_seed,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// The operator's login for the genesis account (auth.md "Account
/// lifecycle" — the genesis member never passes the applicant flow, so
/// the bootstrap creates its credentials): seeded in the terminal member
/// state with the email marked verified, so the account reaper can never
/// touch it. Idempotent: an existing row is left untouched.
pub async fn insert_credentials(
    pool: &PgPool,
    actor_id: Uuid,
    email: &str,
    password_hash: &str,
) -> Result<bool, sqlx::Error> {
    Ok(sqlx::query!(
        "INSERT INTO user_credentials
             (actor_id, email, password_hash, account_state, email_verified_at)
         VALUES ($1, $2, $3, 'member', NOW())
         ON CONFLICT (actor_id) DO NOTHING",
        actor_id,
        email,
        password_hash,
    )
    .execute(pool)
    .await?
    .rows_affected()
        == 1)
}

pub async fn system_key(pool: &PgPool, actor_id: Uuid) -> Result<Option<Vec<u8>>, sqlx::Error> {
    Ok(sqlx::query!(
        "SELECT signing_seed FROM system_actor_keys WHERE actor_id = $1",
        actor_id,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| r.signing_seed))
}

/// Seeds a reserved Type into the naming service with its
/// content-addressed UUIDv5 key — stable from network birth regardless of
/// when the name first lands on L1 (network.md §2; hashtag.md).
pub async fn seed_reserved_type(conn: &mut PgConnection, name: &str) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO hashtags (id, name) VALUES ($1, $2)
         ON CONFLICT (name) DO NOTHING",
        common::hashtag_uuid(name),
        name,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Appends a parameter-carrier version row (newest row wins; the genesis
/// seed is the fold's base case — network.md §3/§4).
pub async fn seed_parameter(
    conn: &mut PgConnection,
    parameter: &str,
    value: &serde_json::Value,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO network_parameter_versions (parameter, value) VALUES ($1, $2)",
        parameter,
        value,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// True once any carrier row exists (idempotency check for the seed).
pub async fn parameters_seeded(pool: &PgPool) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar!(r#"SELECT EXISTS(SELECT 1 FROM network_parameter_versions) AS "exists!""#)
        .fetch_one(pool)
        .await
}
