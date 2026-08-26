//! ´mod:module:rate-limit´
//!
//! Auth-endpoint throttle state (auth.md "Rate limiting") — the SQL half
//! of the api crate's ratelimit module.
//!
//! Counted limits and the login backoff share the `auth_rate_limits`
//! table; every state change is one atomic upsert, so concurrent attempts
//! never race.

use chrono::{DateTime, Utc};
use sqlx::PgPool;

/// Counts an attempt against a fixed window and returns the count this
/// attempt landed at: 1 when the window was fresh or expired, else the
/// incremented total. The caller compares against its limit — the
/// attempt is counted either way, so refused attempts keep the window
/// hot.
pub async fn count_in_window(
    pool: &PgPool,
    scope: &str,
    key: &str,
    window_secs: f64,
) -> Result<i32, sqlx::Error> {
    let row = sqlx::query!(
        r#"
        INSERT INTO auth_rate_limits AS r (scope, key, window_start, count)
        VALUES ($1, $2, now(), 1)
        ON CONFLICT (scope, key) DO UPDATE SET
            count = CASE
                WHEN r.window_start <= now() - make_interval(secs => $3)
                THEN 1 ELSE r.count + 1 END,
            window_start = CASE
                WHEN r.window_start <= now() - make_interval(secs => $3)
                THEN now() ELSE r.window_start END
        RETURNING count
        "#,
        scope,
        key,
        window_secs,
    )
    .fetch_one(pool)
    .await?;
    Ok(row.count)
}

/// The moment a backoff-scoped key unblocks, when it is currently
/// blocked; None when the key is unknown or free.
pub async fn blocked_until(
    pool: &PgPool,
    scope: &str,
    key: &str,
) -> Result<Option<DateTime<Utc>>, sqlx::Error> {
    let row = sqlx::query!(
        r#"
        SELECT blocked_until
        FROM auth_rate_limits
        WHERE scope = $1 AND key = $2 AND blocked_until > now()
        "#,
        scope,
        key,
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.and_then(|r| r.blocked_until))
}

/// Records one consecutive failure and derives the block in the same
/// statement: from the threshold-th failure on, the delay doubles per
/// failure from `base_secs`, capped at `cap_secs` (auth.md "Rate
/// limiting" — exponential backoff on consecutive failures). Returns
/// the new failure count.
pub async fn record_failure(
    pool: &PgPool,
    scope: &str,
    key: &str,
    threshold: i32,
    base_secs: f64,
    cap_secs: f64,
) -> Result<i32, sqlx::Error> {
    let row = sqlx::query!(
        r#"
        INSERT INTO auth_rate_limits AS r (scope, key, window_start, failures, blocked_until)
        VALUES (
            $1, $2, now(), 1,
            CASE WHEN 1 >= $3
                THEN now() + make_interval(secs => least($5, $4 * power(2, (1 - $3)::float8)))
            END
        )
        ON CONFLICT (scope, key) DO UPDATE SET
            failures = r.failures + 1,
            window_start = now(),
            blocked_until = CASE WHEN r.failures + 1 >= $3
                THEN now() + make_interval(secs => least($5, $4 * power(2, (r.failures + 1 - $3)::float8)))
            END
        RETURNING failures
        "#,
        scope,
        key,
        threshold,
        base_secs,
        cap_secs,
    )
    .fetch_one(pool)
    .await?;
    Ok(row.failures)
}

/// Clears a backoff key — a successful attempt ends the consecutive
/// run.
pub async fn clear(pool: &PgPool, scope: &str, key: &str) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "DELETE FROM auth_rate_limits WHERE scope = $1 AND key = $2",
        scope,
        key,
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Sweeps rows idle past the retention bound and not currently
/// blocking — the GC half of the table's lifecycle. Returns the number
/// of rows removed.
pub async fn sweep_idle(pool: &PgPool, idle_secs: f64) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        DELETE FROM auth_rate_limits
        WHERE window_start < now() - make_interval(secs => $1)
          AND (blocked_until IS NULL OR blocked_until < now())
        "#,
        idle_secs,
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}
