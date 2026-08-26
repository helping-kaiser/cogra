//! ´mod:module:ingest´
//!
//! Record ingestion (architecture.md "Record ingestion (the mirror
//! contract)"): per epoch, pull the accepted ordered act sequence through
//! the seam and append it to the mirror, advancing the stored epoch
//! cursor.
//!
//! Ingestion state is never precious — a crash between epochs resumes
//! from the cursor, and the mirror is rebuildable from the published
//! sequence at any time.

use postgres_store::PgPool;
use postgres_store::{mirror, staged};

use crate::l1::L1Boundary;

/// Default staged-write GC bound, in epochs (data-model.md "Staged
/// writes"; overridden by STAGED_WRITE_GC_EPOCHS — development.md).
pub const DEFAULT_GC_AFTER_EPOCHS: i64 = 8;

#[derive(Debug, thiserror::Error)]
pub enum IngestError {
    #[error(transparent)]
    Boundary(#[from] crate::l1::BoundaryError),
    #[error(transparent)]
    Mirror(#[from] mirror::MirrorError),
    #[error(transparent)]
    Staged(#[from] staged::StagedError),
}

/// A confirm-side promotion that did not follow its record. The record
/// landed and the mirror governs, so ingestion carries on and a later
/// rebuild can re-run the promotion — but the failure rides the outcome
/// instead of living only in the log, so callers and tests can see it.
#[derive(Debug)]
pub struct PromotionFailure {
    /// Which promotion flow failed: `onboarding`, `content`, `profile`.
    pub stage: &'static str,
    pub staged: uuid::Uuid,
    pub act_id: String,
    pub error: String,
}

impl std::fmt::Display for PromotionFailure {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{} promotion failed for staged {} (act {}): {}",
            self.stage, self.staged, self.act_id, self.error
        )
    }
}

/// One ingestion pass's result: the epochs landed, the staged writes
/// their records confirmed, and any promotion that failed on the way.
#[derive(Debug, Default)]
pub struct IngestOutcome {
    pub epochs: u64,
    pub promoted: Vec<staged::PromotedWrite>,
    pub promotion_failures: Vec<PromotionFailure>,
}

/// Ingests every epoch published since the cursor, promoting staged
/// writes whose records land and collecting the ones that never will
/// (`gc_after_epochs` — an operational parameter, development.md).
/// Returns the promoted writes so flows built on confirmation (landing an
/// applicant, promoting display rows) can act on them.
///
/// Flow state advances here, on confirmation (architecture.md "The write
/// path" step 5): a landed applicant Registration creates its account
/// rows, and a landed content record promotes its payload into carriage
/// and its display rows into view. Every ingestion path runs it — the
/// live loop, the dev CLI, and rebuilds alike — so a rebuild reconstructs
/// the same L2 state the live path produced.
pub async fn ingest_pending<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    gc_after_epochs: i64,
) -> Result<IngestOutcome, IngestError> {
    let cursor = mirror::last_ingested_epoch(pool).await?;
    let packages = boundary.epochs_since(cursor).await?;
    let mut outcome = IngestOutcome::default();
    for package in &packages {
        mirror::ingest_epoch(pool, package).await?;
        let landed = staged::promote_landed(pool, package.epoch).await?;
        tracing::info!(
            epoch = package.epoch,
            records = package.records.len(),
            confirmed = landed.len(),
            "epoch ingested into the mirror"
        );
        outcome.epochs += 1;
        outcome.promoted.extend(landed);
    }
    let mut failures = crate::onboarding::land_promoted(pool, &outcome.promoted).await;
    failures.extend(crate::content::land_promoted(pool, &outcome.promoted).await);
    failures.extend(crate::profile::land_promoted(pool, &outcome.promoted).await);
    for failure in &failures {
        tracing::error!(
            stage = failure.stage,
            staged = %failure.staged,
            act = %failure.act_id,
            error = %failure.error,
            "confirm-side promotion failed; record remains unpromoted"
        );
    }
    outcome.promotion_failures = failures;
    if let Some(last) = packages.last() {
        let expired = staged::expire_due(pool, last.epoch, gc_after_epochs).await?;
        let reaped = staged::reap_expired(pool, last.epoch, gc_after_epochs).await?;
        if expired > 0 || reaped > 0 {
            tracing::info!(expired, reaped, "staged-write GC pass");
        }
    }
    Ok(outcome)
}

/// The server's background ingestion loop: poll the seam on an interval.
/// The stand-in publishes on epoch close; the real substrate's cadence
/// arrives with the swap.
pub async fn ingest_loop<B: L1Boundary>(
    boundary: B,
    pool: PgPool,
    interval_secs: u64,
    gc_after_epochs: i64,
) {
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval_secs));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        ticker.tick().await;
        if let Err(e) = ingest_pending(&boundary, &pool, gc_after_epochs).await {
            tracing::error!(error = %e, "ingestion pass failed; will retry");
        }
    }
}
