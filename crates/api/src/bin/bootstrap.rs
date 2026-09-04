//! Instance bootstrap — the one-shot setup step that brings a CoGra
//! instance into existence (api::bootstrap; architecture.md "Genesis
//! bootstrap"). Not a request path; run once, by hand. Re-running is
//! safe: a half-failed run completes its missing half.

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

/// Runs the bootstrap and prints what an operator needs afterwards: the
/// genesis identity, the login that reaches it, and the one-time recovery
/// code. `.env` is read first, with the same precedence the server uses
/// (main.rs).
///
/// `GENESIS_PASSWORD` is required rather than defaulted, on the posture
/// `DATABASE_URL` already takes: a deployment that forgets it should get an
/// error, not a running instance whose operator account stands on a
/// publicly-known password. The other genesis inputs keep their defaults —
/// a handle and a display name are not secrets.
///
/// The admission burn is seeded at 100 units, which buys an admitted
/// account roughly 1893 acts at the reference θ.
#[tokio::main]
async fn main() -> anyhow::Result<()> {
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
        burn_per_account_micro: 100_000_000,
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

    let email = env_or("GENESIS_EMAIL", "genesis@cogra.local");
    let password = std::env::var("GENESIS_PASSWORD").context(
        "GENESIS_PASSWORD must be set (see .env.example): the operator login for the \
         Genesis Moderator is never a compiled-in default",
    )?;
    let login = api::bootstrap::ensure_operator_login(&pool, &handle, &email, &password).await?;
    if login.credentials_created {
        println!("  Operator login    : {email} (GENESIS_EMAIL / GENESIS_PASSWORD)");
    }
    if let Some(code) = login.recovery_code {
        println!("  Recovery code     : {code}");
        println!("    Shown only this once — it restores the genesis actor in the app");
        println!("    (sign in, then Restore). A lost code can be replaced from Settings.");
    }
    Ok(())
}
