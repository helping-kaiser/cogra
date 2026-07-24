// The network parameter carrier's read side (data-model.md
// `network_parameter_versions`): append-only version rows per governed
// parameter, newest row in force. Writes happen at genesis (the
// bootstrap's seed) and through governance finalization — never here.

use sqlx::PgPool;

/// The value in force for one parameter; None when the parameter was
/// never seeded.
pub async fn current(
    pool: &PgPool,
    parameter: &str,
) -> Result<Option<serde_json::Value>, sqlx::Error> {
    sqlx::query_scalar!(
        "SELECT value FROM network_parameter_versions
         WHERE parameter = $1
         ORDER BY created_at DESC LIMIT 1",
        parameter,
    )
    .fetch_optional(pool)
    .await
}

/// An integer-valued parameter, or None when unseeded or not an integer.
pub async fn current_i64(pool: &PgPool, parameter: &str) -> Result<Option<i64>, sqlx::Error> {
    Ok(current(pool, parameter).await?.and_then(|v| v.as_i64()))
}
