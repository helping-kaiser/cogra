// API entry point — Axum HTTP server hosting the async-graphql schema,
// with the L1 stand-in behind the seam and the mirror-ingestion and
// applicant-reaper loops running alongside.

use std::sync::Arc;

use anyhow::Context;
use api::auth::AuthConfig;
use api::l1::StandInBoundary;
use api::mailer::DevMailer;
use api::onboarding::OnboardingConfig;
use api::schema::ApiContext;
use l1_standin::{StandIn, StandInConfig};
use tracing_subscriber::EnvFilter;

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

/// The session-signing key (auth.md "Access token"): from
/// `SESSION_SIGNING_SEED` (32 bytes, hex). Absent in dev, an ephemeral
/// key is generated — sessions then die with the process, which is loud
/// enough to notice and harmless locally.
fn auth_config() -> anyhow::Result<AuthConfig> {
    match std::env::var("SESSION_SIGNING_SEED") {
        Ok(hex_seed) => {
            let bytes = hex::decode(hex_seed.trim()).context("SESSION_SIGNING_SEED must be hex")?;
            let seed: [u8; 32] = bytes
                .as_slice()
                .try_into()
                .map_err(|_| anyhow::anyhow!("SESSION_SIGNING_SEED must be 32 bytes of hex"))?;
            Ok(AuthConfig::from_seed(seed)?)
        }
        Err(_) => {
            tracing::warn!(
                "SESSION_SIGNING_SEED not set; using an ephemeral session key — \
                 sessions will not survive a restart"
            );
            Ok(AuthConfig::ephemeral()?)
        }
    }
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

    let standin = StandIn::new(pool.clone(), StandInConfig::default());
    let boundary = StandInBoundary(standin.clone());
    let ingest_interval: u64 = env_or("L1_INGEST_INTERVAL_SECS", "2")
        .parse()
        .context("L1_INGEST_INTERVAL_SECS must be a number of seconds")?;
    // The staged-write GC bound (data-model.md "Staged writes" — an
    // operational parameter; development.md).
    let gc_after_epochs: i64 = env_or(
        "STAGED_WRITE_GC_EPOCHS",
        &api::ingest::DEFAULT_GC_AFTER_EPOCHS.to_string(),
    )
    .parse()
    .context("STAGED_WRITE_GC_EPOCHS must be a number of epochs")?;
    tokio::spawn(api::ingest::ingest_loop(
        boundary.clone(),
        pool.clone(),
        ingest_interval,
        gc_after_epochs,
    ));

    // The applicant reaper (auth.md "Account lifecycle").
    let reaper_interval: u64 = env_or("APPLICANT_REAPER_INTERVAL_SECS", "600")
        .parse()
        .context("APPLICANT_REAPER_INTERVAL_SECS must be a number of seconds")?;
    tokio::spawn(api::onboarding::reaper_loop(pool.clone(), reaper_interval));

    let admission_burn_micro: i64 = env_or(
        "ADMISSION_BURN_MICRO",
        &OnboardingConfig::default().admission_burn_micro.to_string(),
    )
    .parse()
    .context("ADMISSION_BURN_MICRO must be an integer of micro-units")?;

    let auth = auth_config()?;
    let schema = api::schema::build(ApiContext {
        pool,
        boundary,
        funding: standin,
        auth: auth.clone(),
        mailer: Arc::new(DevMailer),
        onboarding: OnboardingConfig {
            admission_burn_micro,
            gc_after_epochs,
        },
    });
    let addr = format!(
        "{}:{}",
        env_or("API_HOST", "0.0.0.0"),
        env_or("API_PORT", "8080")
    );
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .with_context(|| format!("binding {addr}"))?;
    tracing::info!("listening on http://{addr} — /graphql, /health, /playground (dev)");
    axum::serve(listener, api::app(schema, auth)).await?;
    Ok(())
}
