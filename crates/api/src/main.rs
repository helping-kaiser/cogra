// API entry point — Axum HTTP server hosting the async-graphql schema,
// with the L1 stand-in behind the seam and the mirror-ingestion loop
// running alongside.

use anyhow::Context;
use api::l1::StandInBoundary;
use l1_standin::{StandIn, StandInConfig};
use tracing_subscriber::EnvFilter;

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // .env first, so plain `cargo run` matches the make targets; real
    // environment variables win over file values (dotenvy never overrides).
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let database_url =
        std::env::var("DATABASE_URL").context("DATABASE_URL must be set (see .env.example)")?;
    let pool = postgres_store::connect(&database_url)
        .await
        .context("connecting to PostgreSQL")?;
    postgres_store::run_migrations(&pool)
        .await
        .context("running Postgres migrations")?;
    tracing::info!("PostgreSQL connected, migrations applied");

    let boundary = StandInBoundary(StandIn::new(pool.clone(), StandInConfig::default()));
    let ingest_interval: u64 = env_or("L1_INGEST_INTERVAL_SECS", "2")
        .parse()
        .context("L1_INGEST_INTERVAL_SECS must be a number of seconds")?;
    tokio::spawn(api::ingest::ingest_loop(
        boundary,
        pool.clone(),
        ingest_interval,
    ));

    let schema = api::schema::build(pool);
    let addr = format!(
        "{}:{}",
        env_or("API_HOST", "0.0.0.0"),
        env_or("API_PORT", "8080")
    );
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .with_context(|| format!("binding {addr}"))?;
    tracing::info!("listening on http://{addr} — /graphql, /health, /playground (dev)");
    axum::serve(listener, api::app(schema)).await?;
    Ok(())
}
