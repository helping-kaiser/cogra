//! ´mod:module:params´
//!
//! The network parameter carrier's read side (data-model.md
//! `network_parameter_versions`): append-only version rows per governed
//! parameter, the newest in force.
//!
//! Writes happen at genesis, from the bootstrap's seed, and through
//! governance finalization — never here.

use sqlx::PgPool;

/// The value in force for one parameter — the one the last finalization
/// to land published, with the genesis seed underneath as the fold's base
/// case (network.md §4); None when the parameter was never seeded.
pub async fn current(
    pool: &PgPool,
    parameter: &str,
) -> Result<Option<serde_json::Value>, sqlx::Error> {
    sqlx::query_scalar!(
        "SELECT value FROM network_parameter_versions
         WHERE parameter = $1
         ORDER BY landed_epoch DESC NULLS LAST,
                  act_time DESC NULLS LAST,
                  position DESC NULLS LAST,
                  created_at DESC, version_id DESC
         LIMIT 1",
        parameter,
    )
    .fetch_optional(pool)
    .await
}

/// One parameter's value in force, with the epoch of the finalization it
/// came from — None for the genesis seed, which carries no landing of its
/// own (the Charter's is the caller's to read: [`charter_epoch`]).
#[derive(Debug, Clone)]
pub struct InForce {
    pub parameter: String,
    pub value: serde_json::Value,
    pub landed_epoch: Option<i64>,
}

/// Every parameter's value in force (or only the named ones, when `keys`
/// is given), ascending by key — the same fold [`current`] applies per
/// parameter. A key the carrier never seeded is absent.
pub async fn all_current(
    pool: &PgPool,
    keys: Option<&[String]>,
) -> Result<Vec<InForce>, sqlx::Error> {
    sqlx::query_as!(
        InForce,
        r#"SELECT DISTINCT ON (parameter)
                  parameter AS "parameter!", value AS "value!", landed_epoch
           FROM network_parameter_versions
           WHERE ($1::text[] IS NULL OR parameter = ANY($1))
           ORDER BY parameter,
                    landed_epoch DESC NULLS LAST,
                    act_time DESC NULLS LAST,
                    position DESC NULLS LAST,
                    created_at DESC, version_id DESC"#,
        keys,
    )
    .fetch_all(pool)
    .await
}

/// The landing epoch of the genesis Charter — the Publisher's first
/// Publish, whose payload carries every parameter's genesis value (the
/// carrier's base case, network.md §4). None until it lands.
pub async fn charter_epoch(pool: &PgPool) -> Result<Option<i64>, sqlx::Error> {
    sqlx::query_scalar!(
        "SELECT r.epoch
         FROM mirror_records r
         JOIN actors a ON a.realization_address = r.author
         WHERE a.kind = 'system' AND a.handle = $1 AND r.family = 'publish'
         ORDER BY r.epoch, r.act_time, r.position
         LIMIT 1",
        crate::genesis::PUBLISHER_HANDLE,
    )
    .fetch_optional(pool)
    .await
}

/// An integer-valued parameter, or None when unseeded or not an integer.
pub async fn current_i64(pool: &PgPool, parameter: &str) -> Result<Option<i64>, sqlx::Error> {
    Ok(current(pool, parameter).await?.and_then(|v| v.as_i64()))
}
