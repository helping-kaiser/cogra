//! Instance bootstrap — the one-shot setup step that brings a CoGra
//! instance into existence (network.md §2, architecture.md "Genesis
//! bootstrap"). Not a request path; run once, by hand, when an instance
//! is created:
//!
//! 1. applies the store schema;
//! 2. seeds the CoGra-side half — operator + system-actor service rows
//!    with custodied keys, the reserved Types, the parameter carrier;
//! 3. lands the L1-side genesis sequence against the stand-in — the
//!    cast's Registrations, the endorsement Opinions, The Charter, the
//!    genesis role Tag — and ingests the genesis epoch into the mirror.
//!
//! Re-running is safe: a fully-bootstrapped instance writes nothing; a
//! half-failed run completes its missing half (api::bootstrap).

use anyhow::Context;
use api::bootstrap::{BootstrapOutcome, GenesisInput, run};
use l1_standin::{StandIn, StandInConfig};
use sha2::{Digest, Sha256};

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

/// SHA-256 hex digest of the canonical version-1 platform-guidelines
/// document, pinned into the Charter payload (network.md §3).
fn guidelines_hash() -> String {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../docs/instances/platform-guidelines.md"
    );
    match std::fs::read(path) {
        Ok(bytes) => format!("{:x}", Sha256::digest(&bytes)),
        Err(e) => {
            tracing::warn!(error = %e, "platform-guidelines.md unreadable; pinning a zero digest");
            format!("{:x}", Sha256::digest(b""))
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // .env first, so plain `cargo run` matches the make targets; real
    // environment variables win over file values (dotenvy never overrides).
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let database_url =
        std::env::var("DATABASE_URL").context("DATABASE_URL must be set (see .env.example)")?;
    let pool = postgres_store::connect(&database_url)
        .await
        .context("connecting to PostgreSQL")?;
    postgres_store::run_migrations(&pool)
        .await
        .context("running Postgres migrations")?;

    let standin = StandIn::new(pool.clone(), StandInConfig::default());
    let input = GenesisInput {
        handle: env_or("GENESIS_HANDLE", "genesis"),
        display_name: env_or("GENESIS_DISPLAY_NAME", "Genesis Moderator"),
        guidelines_version: "1".to_string(),
        guidelines_hash: guidelines_hash(),
        burn_per_account_micro: 100_000_000, // 100 units ≈ 1893 acts at reference θ
    };
    let handle = input.handle.clone();

    match run(&standin, &pool, input).await? {
        BootstrapOutcome::Fresh => {
            println!("Bootstrap complete — genesis records landed in the mirror.");
        }
        BootstrapOutcome::Repaired => {
            println!("Bootstrap completed the L1 half of a partially-failed run.");
        }
        BootstrapOutcome::AlreadyComplete => {
            println!("Instance already bootstrapped — nothing to do.");
        }
    }
    if let Some((id, address)) = api::bootstrap::genesis_identity(&pool, &handle).await? {
        println!("  Genesis Moderator : {id} (@{handle}, L0 address {address})");
    }
    Ok(())
}
