//! The L1 stand-in plays the substrate behind the seam, implementing the
//! layer1-interface.md contract until PeerNetworks Layer 1 ships
//! (roadmap.md "The stand-in and the swap"). Two simplifications are
//! named there and carried here:
//!
//! - Money is numbers only: the B_i surface and θ-debits are integer
//!   micro-unit balances, with no real Layer 0 economy behind them.
//! - Standing is partial: formation, the admission handshake, ordering,
//!   causal keys, maturity, and the θ-ledger are implemented in full, but
//!   the conserved standing solve of §11.3–11.5 is not — every act's
//!   stamp is taken as 1, so the W2a wall and W2b door pass trivially.
//!   The gates' call-sites are real; the real substrate supplies the
//!   real stamps.
//!
//! This crate owns the l1_* tables directly — the named exception to "SQL
//! only in postgres-store" (CLAUDE.md) — and is the only code that
//! touches them. It is replaced wholesale at the swap; no CoGra slice
//! reopens on top of it.

mod close;
mod seal;

use std::sync::Arc;

use common::l1::handshake::{AccountBalance, ApprovalWitness, EpochPackage};
use common::l1::identifier::ActId;
use common::l1::{PreSignedProposal, VerifiedAct};
use ed25519_dalek::SigningKey;
use rand::RngCore;
use rand::rngs::OsRng;
use sqlx::PgPool;
use tokio::sync::OnceCell;

/// Operating values for the constants layer1-interface.md §6 marks
/// "illustrative, not locked": the per-act price θ (micro-units), the
/// epoch act budget N_epoch, and the payload carriage bound M_payload.
#[derive(Debug, Clone)]
pub struct StandInConfig {
    /// θ in integer micro-units (1e-6).
    pub theta_micro: i64,
    /// N_epoch — the epoch target act budget (layer1-interface.md §11.6).
    pub epoch_target_acts: i64,
    /// M_payload — per-act payload bound, aggregate over a hyper-edge's
    /// projections (layer1-interface.md §8.4).
    pub max_payload_bytes: usize,
}

impl StandInConfig {
    /// The default act price in micro-units. Named so a caller pricing a
    /// batch against it — a test funding an author for exactly N acts —
    /// states the multiple rather than a bare number.
    pub const DEFAULT_THETA_MICRO: i64 = 52_810;

    /// A checked config. The three values are operating constants, not free
    /// parameters: a non-positive θ lets an author with no account at all
    /// pass the solvency gate, a non-positive act budget defers every
    /// candidate, and a zero payload bound admits no act that carries
    /// anything.
    pub fn new(
        theta_micro: i64,
        epoch_target_acts: i64,
        max_payload_bytes: usize,
    ) -> Result<Self, StandInError> {
        let config = Self {
            theta_micro,
            epoch_target_acts,
            max_payload_bytes,
        };
        config.check()?;
        Ok(config)
    }

    /// The same check, for a config assembled field-by-field. `StandIn`
    /// runs it before every close, so a degenerate value is refused rather
    /// than quietly degrading the epoch it governs.
    pub fn check(&self) -> Result<(), StandInError> {
        if self.theta_micro <= 0 {
            return Err(StandInError::Host(format!(
                "θ must be positive, got {}",
                self.theta_micro
            )));
        }
        if self.epoch_target_acts <= 0 {
            return Err(StandInError::Host(format!(
                "the epoch act budget must be positive, got {}",
                self.epoch_target_acts
            )));
        }
        if self.max_payload_bytes == 0 {
            return Err(StandInError::Host(
                "the payload bound must be positive".into(),
            ));
        }
        Ok(())
    }
}

impl Default for StandInConfig {
    fn default() -> Self {
        Self {
            theta_micro: Self::DEFAULT_THETA_MICRO,
            epoch_target_acts: 10_000,
            max_payload_bytes: 64 * 1024,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum StandInError {
    /// The submission is not a well-formed act; no Layer-1 object exists
    /// for it (layer1-interface.md §8.2 — a failure produces no object).
    #[error("formation: {0}")]
    Formation(String),
    /// A signature, commitment, or key binding failed.
    #[error("authentication: {0}")]
    Authentication(String),
    /// Equivocation or identifier reuse (layer1-interface.md §8.1).
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("unknown act {0}")]
    UnknownAct(String),
    /// The host itself is at fault — a degenerate operating constant, or a
    /// selection whose own published order it could not honor. No
    /// submission is to blame and no retry helps.
    #[error("host: {0}")]
    Host(String),
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
    /// The host identity, read once per process. Behind an `Arc` because
    /// `StandIn` is cloned per consumer over one shared pool, and the
    /// identity is one per database, not one per clone.
    host_key: Arc<OnceCell<SigningKey>>,
}

impl StandIn {
    pub fn new(pool: PgPool, config: StandInConfig) -> Self {
        Self {
            pool,
            config,
            host_key: Arc::new(OnceCell::new()),
        }
    }

    pub fn config(&self) -> &StandInConfig {
        &self.config
    }

    /// The host signing key — generated on first use, persisted so every
    /// process sees one host identity, and then held: it is a
    /// process-lifetime singleton, so re-reading it per seal buys nothing
    /// and re-drawing entropy per seal buys less.
    pub(crate) async fn host_key(&self) -> Result<SigningKey, StandInError> {
        self.host_key
            .get_or_try_init(|| self.load_host_key())
            .await
            .cloned()
    }

    /// Read the singleton, minting it only if the table is empty.
    /// Insert-if-absent then read whatever won: a process that loses the
    /// race reads back the seed that did land, rather than minting a
    /// second one.
    async fn load_host_key(&self) -> Result<SigningKey, StandInError> {
        let existing = sqlx::query!("SELECT signing_seed FROM l1_host WHERE singleton")
            .fetch_optional(&self.pool)
            .await?;
        let seed = match existing {
            Some(row) => row.signing_seed,
            None => {
                let mut fresh = [0u8; 32];
                OsRng.fill_bytes(&mut fresh);
                sqlx::query!(
                    "INSERT INTO l1_host (singleton, signing_seed) VALUES (TRUE, $1)
                     ON CONFLICT (singleton) DO NOTHING",
                    &fresh[..],
                )
                .execute(&self.pool)
                .await?;
                sqlx::query!("SELECT signing_seed FROM l1_host WHERE singleton")
                    .fetch_one(&self.pool)
                    .await?
                    .signing_seed
            }
        };
        let stored: [u8; 32] = seed
            .as_slice()
            .try_into()
            .map_err(|_| StandInError::Authentication("stored host seed is not 32 bytes".into()))?;
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
    /// orderable.
    ///
    /// Approving does not close an epoch. Closing is the substrate's own
    /// clock (`close_loop`, or `l1-dev close` for a deterministic test):
    /// the real Layer 1 does not close because a writer wrote, and a
    /// backlog the close cannot drain — acts deferred for an unsatisfied
    /// dependency or an insolvent author keep `status = 'approved'` by
    /// design — would otherwise put a whole locked close on every single
    /// request, to select nothing.
    pub async fn approve(&self, witness: ApprovalWitness) -> Result<(), StandInError> {
        seal::approve(self, witness).await
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

/// The surfaces that are *not* the seam: what CoGra reaches for that the
/// real Layer 1 will not offer, named in one place so the swap has a list
/// instead of a search.
///
/// The seam is `api`'s `L1Boundary` — the two relay legs, the epoch read,
/// the B_i read, the published θ. Everything here is stand-in-only:
/// crediting a burn stands in for a Layer-0 economy CoGra does not run,
/// closing an epoch stands in for a clock the substrate keeps itself, and
/// reading back a sealed act is a crash-recovery affordance the seam
/// deliberately does not carry. At the swap each of these needs an answer
/// of its own — a real L0 rail, the substrate's own close, and a resumable
/// bootstrap — and none of them is "one new implementation of the
/// boundary".
pub trait DevSubstrate {
    /// Credit a committed burn to an address (stand-in Layer 0).
    fn credit_burn(
        &self,
        address: &str,
        amount_micro: i64,
    ) -> impl std::future::Future<Output = Result<(), StandInError>> + Send;

    /// Close the current epoch, standing in for the substrate's own clock.
    fn close_epoch(
        &self,
    ) -> impl std::future::Future<Output = Result<Option<EpochPackage>, StandInError>> + Send;

    /// Read back a sealed act, so an interrupted bootstrap can resume.
    fn sealed_act(
        &self,
        act_id: &ActId,
    ) -> impl std::future::Future<Output = Result<Option<StoredAct>, StandInError>> + Send;
}

impl DevSubstrate for StandIn {
    async fn credit_burn(&self, address: &str, amount_micro: i64) -> Result<(), StandInError> {
        StandIn::credit_burn(self, address, amount_micro).await
    }

    async fn close_epoch(&self) -> Result<Option<EpochPackage>, StandInError> {
        StandIn::close_epoch(self).await
    }

    async fn sealed_act(&self, act_id: &ActId) -> Result<Option<StoredAct>, StandInError> {
        StandIn::sealed_act(self, act_id).await
    }
}

/// The dev clock: close an epoch on a fixed interval, playing the real
/// substrate closing on its own clock. Spawned by the API host when the
/// interval is configured (development.md); an idle tick publishes
/// nothing, and manual `l1-dev close` stays available for deterministic
/// tests.
pub async fn close_loop(standin: StandIn, interval_secs: u64) {
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval_secs));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
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
