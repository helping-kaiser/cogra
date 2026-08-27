//! PostgreSQL access layer for CoGra's stores.
//!
//! Covers the record mirror, the overlay, and the authoritative L2 state
//! (data-model.md). All of CoGra's SQL lives here and nowhere else; the one
//! exception is the `l1-standin` crate, which owns its own L1-side tables
//! behind the seam.

pub mod auth;
pub mod content;
pub mod genesis;
pub mod hashtag;
pub mod mirror;
pub mod params;
pub mod profile;
pub mod rate_limit;
pub mod references;
pub mod staged;
pub mod stance;
pub mod topics;

/// Re-exported so callers don't need a direct sqlx dependency.
pub use sqlx::PgPool;
use sqlx::migrate::Migrator;
use sqlx::postgres::PgPoolOptions;

/// The workspace-level migrations, embedded at compile time so the binary
/// can migrate on startup without a checkout of `migrations/` next to it.
pub static MIGRATOR: Migrator = sqlx::migrate!("../../migrations");

/// Opens the PostgreSQL connection pool.
pub async fn connect(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await
}

/// Applies any pending migrations.
pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    MIGRATOR.run(pool).await
}

/// Round-trip probe — true when PostgreSQL answers `SELECT 1`.
pub async fn ping(pool: &PgPool) -> bool {
    sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(pool)
        .await
        .is_ok()
}
