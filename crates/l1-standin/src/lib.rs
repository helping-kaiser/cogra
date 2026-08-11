// The L1 stand-in: an implementation of the layer1-interface.md contract
// that plays the substrate behind the seam until PeerNetworks Layer 1
// ships (roadmap.md "The stand-in and the swap"). Named simplifications,
// both documented there:
//
// - Money is honored as numbers — the B_i surface and θ-debits are integer
//   micro-unit balances with no real Layer 0 economy behind them.
// - Standing is simplified — formation, the admission handshake, ordering,
//   causal keys, maturity, and the θ-ledger are implemented in full, while
//   the staged-standing solve of §11.4–11.5 is not: every act's stamp is
//   taken as 1, so the W2a wall and W2b door pass trivially. The gates'
//   call-sites are real; the real substrate brings the real stamps.
//
// The stand-in owns the l1_* tables (its own SQL — the named exception to
// "SQL only in postgres-store", CLAUDE.md) and is the only code that
// touches them. It is replaced wholesale at the swap; no CoGra slice
// reopens.

mod close;
mod seal;

use common::l1::handshake::{AccountBalance, ApprovalWitness, EpochPackage};
use common::l1::identifier::ActId;
use common::l1::{PreSignedProposal, VerifiedAct};
use ed25519_dalek::SigningKey;
use rand::RngCore;
use rand::rngs::OsRng;
use sqlx::PgPool;

/// Operating values for the constants layer1-interface.md §6 marks
/// "illustrative, not locked": the per-act price θ (micro-units), the
/// epoch act budget N_epoch, and the payload carriage bound M_payload.
#[derive(Debug, Clone)]
pub struct StandInConfig {
    /// θ in integer micro-units (1e-6). Default is the §6 reference value
    /// θ ≈ 0.05281.
    pub theta_micro: i64,
    /// N_epoch — the epoch target act budget (`def:epoch:epoch-act-budget`).
    pub epoch_target_acts: i64,
    /// M_payload — per-act payload bound, aggregate over a hyper-edge's
    /// projections (`def:graph:act-payload-projection`).
    pub max_payload_bytes: usize,
}

impl Default for StandInConfig {
    fn default() -> Self {
        Self {
            theta_micro: 52_810,
            epoch_target_acts: 10_000,
            max_payload_bytes: 64 * 1024,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum StandInError {
    /// The submission is not a well-formed act; no Layer-1 object exists
    /// for it (`def:graph:verified-act` — a failure produces no object).
    #[error("formation: {0}")]
    Formation(String),
    /// A signature, commitment, or key binding failed.
    #[error("authentication: {0}")]
    Authentication(String),
    /// Equivocation or identifier reuse (`def:graph:act-identifier`).
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("unknown act {0}")]
    UnknownAct(String),
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
}

/// An act read back from the host's store: the exact sealed object as
/// returned to its author at seal time, and whether an approval witness
/// has been recorded for it.
#[derive(Debug, Clone, PartialEq)]
pub struct StoredAct {
    pub act: VerifiedAct,
    pub approved: bool,
}

/// The stand-in host. Cheap to clone; all state lives in Postgres so every
/// process pointed at the same database speaks to the same substrate.
#[derive(Clone)]
pub struct StandIn {
    pool: PgPool,
    config: StandInConfig,
}

impl StandIn {
    pub fn new(pool: PgPool, config: StandInConfig) -> Self {
        Self { pool, config }
    }

    pub fn config(&self) -> &StandInConfig {
        &self.config
    }

    /// The host signing key — generated on first use, persisted so every
    /// process sees one host identity.
    pub(crate) async fn host_key(&self) -> Result<SigningKey, StandInError> {
        let mut seed = [0u8; 32];
        OsRng.fill_bytes(&mut seed);
        // Insert-if-absent, then read whatever won.
        sqlx::query!(
            "INSERT INTO l1_host (singleton, signing_seed) VALUES (TRUE, $1)
             ON CONFLICT (singleton) DO NOTHING",
            &seed[..],
        )
        .execute(&self.pool)
        .await?;
        let row = sqlx::query!("SELECT signing_seed FROM l1_host WHERE singleton")
            .fetch_one(&self.pool)
            .await?;
        let stored: [u8; 32] =
            row.signing_seed.as_slice().try_into().map_err(|_| {
                StandInError::Authentication("stored host seed is not 32 bytes".into())
            })?;
        Ok(SigningKey::from_bytes(&stored))
    }

    /// The host public key clients verify seals against.
    pub async fn host_public_key(&self) -> Result<Vec<u8>, StandInError> {
        Ok(self.host_key().await?.verifying_key().as_bytes().to_vec())
    }

    /// The stand-in's Layer 0 surface: credit a committed burn to an
    /// address — B_i and the residual balance both rise by the burned
    /// amount. Numbers only; no real reserve economy.
    pub async fn credit_burn(&self, address: &str, amount_micro: i64) -> Result<(), StandInError> {
        if amount_micro <= 0 {
            return Err(StandInError::Formation(
                "burn amount must be positive".into(),
            ));
        }
        sqlx::query!(
            "INSERT INTO l1_accounts (address, burned_total_micro, balance_micro)
             VALUES ($1, $2, $2)
             ON CONFLICT (address) DO UPDATE SET
                 burned_total_micro = l1_accounts.burned_total_micro + EXCLUDED.burned_total_micro,
                 balance_micro      = l1_accounts.balance_micro + EXCLUDED.balance_micro",
            address,
            amount_micro,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// The B_i read of the seam. An address the ledger has never seen is a
    /// zero account, not an error — the surface is a total function.
    pub async fn balance(&self, address: &str) -> Result<AccountBalance, StandInError> {
        let row = sqlx::query!(
            "SELECT burned_total_micro, balance_micro, action_count
             FROM l1_accounts WHERE address = $1",
            address,
        )
        .fetch_optional(&self.pool)
        .await?;
        let (burned, balance, count) = row
            .map(|r| (r.burned_total_micro, r.balance_micro, r.action_count))
            .unwrap_or((0, 0, 0));
        Ok(AccountBalance {
            address: address.to_string(),
            burned_total: burned as f64 / 1e6,
            balance: balance as f64 / 1e6,
            action_count: count,
        })
    }

    /// Relay leg 1 — seal: verify the pre-signed proposal, add salts and
    /// commitments, seal the verified act (seal.rs).
    pub async fn seal(&self, pre: PreSignedProposal) -> Result<VerifiedAct, StandInError> {
        seal::seal(self, pre).await
    }

    /// Crash-recovery read (a substrate-side surface like `credit_burn`
    /// and `close_epoch` — the seam deliberately does not carry it): the
    /// act stored under an identifier, so the genesis bootstrap can resume
    /// past acts an interrupted run already landed instead of replaying
    /// them into a Conflict.
    pub async fn sealed_act(&self, act_id: &ActId) -> Result<Option<StoredAct>, StandInError> {
        seal::sealed_act(self, act_id).await
    }

    /// Relay leg 2 — approve: verify the approval witness; the act becomes
    /// orderable. Closes the epoch when the act budget fills.
    pub async fn approve(&self, witness: ApprovalWitness) -> Result<(), StandInError> {
        seal::approve(self, witness).await?;
        let approved = sqlx::query_scalar!(
            r#"SELECT COUNT(*) AS "n!" FROM l1_acts WHERE status = 'approved'"#
        )
        .fetch_one(&self.pool)
        .await?;
        if approved >= self.config.epoch_target_acts {
            self.close_epoch().await?;
        }
        Ok(())
    }

    /// Close the current epoch: fix the authoritative ordered act sequence,
    /// assign causal keys and maturities, consummate θ-debits, publish
    /// (close.rs). A host/dev operation — the seam consumers never call it;
    /// the real substrate closes on its own clock. Returns the published
    /// package, or None when nothing was orderable.
    pub async fn close_epoch(&self) -> Result<Option<EpochPackage>, StandInError> {
        close::close_epoch(self).await
    }

    /// The ingest read of the seam: every closed epoch after `after`, in
    /// order, as published packages (§11.6).
    pub async fn epochs_since(&self, after: i64) -> Result<Vec<EpochPackage>, StandInError> {
        close::epochs_since(self, after).await
    }

    pub(crate) fn pool(&self) -> &PgPool {
        &self.pool
    }
}

/// The dev clock: close an epoch on a fixed interval, playing the real
/// substrate closing on its own clock. Spawned by the API host when the
/// interval is configured (development.md); an idle tick publishes
/// nothing, and manual `l1-dev close` stays available for deterministic
/// tests.
pub async fn close_loop(standin: StandIn, interval_secs: u64) {
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval_secs));
    loop {
        ticker.tick().await;
        match standin.close_epoch().await {
            Ok(Some(package)) => tracing::info!(
                epoch = package.epoch,
                records = package.records.len(),
                "interval close published an epoch"
            ),
            Ok(None) => {}
            Err(e) => tracing::error!(error = %e, "interval close failed; will retry"),
        }
    }
}
