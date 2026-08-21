//! The network parameter carrier's read side (network.md §4): the value
//! in force is the one the last finalization to land published, with the
//! genesis seed underneath as the fold's base case. Requires Postgres
//! (`make up`).

use postgres_store::{genesis, params};
use sqlx::PgPool;

/// Appends a carrier row under a record's landing coordinates. Written
/// here rather than through a store function because governance
/// finalization is not built yet — the read has to hold before the
/// writer that will feed it exists.
async fn landed(pool: &PgPool, parameter: &str, value: i64, epoch: i64, position: i64) {
    sqlx::query(
        "INSERT INTO network_parameter_versions
             (parameter, value, landed_epoch, act_time, position)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(parameter)
    .bind(serde_json::json!(value))
    .bind(epoch)
    .bind(position + 1)
    .bind(position)
    .execute(pool)
    .await
    .expect("carrier row");
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_finalization_that_landed_last_is_in_force(pool: PgPool) {
    let mut conn = pool.acquire().await.expect("conn");
    genesis::seed_parameter(&mut conn, "quorum", &serde_json::json!(1))
        .await
        .expect("seed");

    // The rows are written in the opposite order from their records: the
    // one appended second was ordered first by L1, which is what a fold
    // replayed out of epoch order produces.
    landed(&pool, "quorum", 9, 9, 0).await;
    landed(&pool, "quorum", 2, 2, 0).await;

    assert_eq!(
        params::current_i64(&pool, "quorum").await.expect("reads"),
        Some(9),
        "the records order the carrier; the clock only proxied them"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_genesis_seed_holds_until_a_finalization_lands(pool: PgPool) {
    let mut conn = pool.acquire().await.expect("conn");
    genesis::seed_parameter(&mut conn, "quorum", &serde_json::json!(1))
        .await
        .expect("seed");
    assert_eq!(
        params::current_i64(&pool, "quorum").await.expect("reads"),
        Some(1)
    );

    landed(&pool, "quorum", 7, 3, 0).await;
    assert_eq!(
        params::current_i64(&pool, "quorum").await.expect("reads"),
        Some(7),
        "the seed is the base case, never a rival to a landed value"
    );

    assert_eq!(
        params::current(&pool, "unseeded").await.expect("reads"),
        None
    );
}
