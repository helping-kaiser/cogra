// Record ingestion (architecture.md "Record ingestion (the mirror
// contract)"): per epoch, pull the accepted ordered act sequence through
// the seam and append it to the mirror, advancing the stored epoch
// cursor. Ingestion state is never precious — a crash between epochs
// resumes from the cursor; the mirror is rebuildable from the published
// sequence at any time.

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

/// One ingestion pass's result: the epochs landed and the staged writes
/// their records confirmed.
#[derive(Debug, Default)]
pub struct IngestOutcome {
    pub epochs: u64,
    pub promoted: Vec<staged::PromotedWrite>,
}

/// Ingests every epoch published since the cursor, promoting staged
/// writes whose records land and collecting the ones that never will
/// (`gc_after_epochs` — an operational parameter, development.md).
/// Returns the promoted writes so flows built on confirmation (landing an
/// applicant, promoting display rows) can act on them.
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
    // Flow state advances on confirmation (architecture.md "The write
    // path" step 5): landed applicant Registrations create their account
    // rows and landed content records promote their payload into
    // carriage and their display rows into view — on every ingestion
    // path: the live loop, the dev CLI, and rebuilds alike.
    crate::onboarding::land_promoted(pool, &outcome.promoted).await;
    crate::content::land_promoted(pool, &outcome.promoted).await;
    crate::profile::land_promoted(pool, &outcome.promoted).await;
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
