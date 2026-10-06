//! ´mod:module:rate-limit´
//!
//! Throttle state — the auth endpoints' limits (auth.md "Rate limiting")
//! and the signing budget (api-spec.md "Conventions") — the SQL half of
//! the api crate's ratelimit module.
//!
//! Counted limits, budget charges, and the login backoff share the
//! `auth_rate_limits` table; every state change is an atomic upsert, so
//! concurrent attempts never race.

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

/// One charge against a fixed window: `n` units into the `(scope, key)`
/// window, which holds at most `limit` per `window_secs`.
#[derive(Debug, Clone, Copy)]
pub struct Charge<'a> {
    pub scope: &'a str,
    pub key: &'a str,
    pub window_secs: f64,
    pub n: i32,
    pub limit: i32,
}

/// Charges every window or none: each charge lands only if its window
/// still has room for all `n` units, and one charge without room rolls
/// the whole set back. Returns whether the set was charged.
///
/// Unlike `count_in_window`, a refusal spends nothing — the charge is a
/// budget the caller waits out, not an attempt being counted against a
/// guesser. Rows are locked in `(scope, key)` order, so two concurrent
/// sets over the same windows cannot deadlock.
pub async fn charge_all_within(pool: &PgPool, charges: &[Charge<'_>]) -> Result<bool, sqlx::Error> {
    let mut ordered = charges.to_vec();
    ordered.sort_by(|a, b| (a.scope, a.key).cmp(&(b.scope, b.key)));
    let mut tx = pool.begin().await?;
    for charge in ordered {
        let charged = sqlx::query_scalar!(
            r#"
            INSERT INTO auth_rate_limits AS r (scope, key, window_start, count)
            SELECT $1::text, $2::text, now(), $4::int4
            WHERE $4::int4 <= $5::int4
            ON CONFLICT (scope, key) DO UPDATE SET
                count = CASE
                    WHEN r.window_start <= now() - make_interval(secs => $3::float8)
                    THEN $4::int4 ELSE r.count + $4::int4 END,
                window_start = CASE
                    WHEN r.window_start <= now() - make_interval(secs => $3::float8)
                    THEN now() ELSE r.window_start END
            WHERE CASE
                WHEN r.window_start <= now() - make_interval(secs => $3::float8)
                THEN $4::int4 ELSE r.count + $4::int4 END <= $5::int4
            RETURNING count
            "#,
            charge.scope,
            charge.key,
            charge.window_secs,
            charge.n,
            charge.limit,
        )
        .fetch_optional(&mut *tx)
        .await?;
        if charged.is_none() {
            tx.rollback().await?;
            return Ok(false);
        }
    }
    tx.commit().await?;
    Ok(true)
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
