// Record ingestion (architecture.md "Record ingestion (the mirror
// contract)"): per epoch, pull the accepted ordered act sequence through
// the seam and append it to the mirror, advancing the stored epoch
// cursor. Ingestion state is never precious — a crash between epochs
// resumes from the cursor; the mirror is rebuildable from the published
// sequence at any time.

use postgres_store::PgPool;
use postgres_store::mirror;

use crate::l1::L1Boundary;

#[derive(Debug, thiserror::Error)]
pub enum IngestError {
    #[error(transparent)]
    Boundary(#[from] crate::l1::BoundaryError),
    #[error(transparent)]
    Mirror(#[from] mirror::MirrorError),
}

/// Ingests every epoch published since the cursor. Returns the number of
/// epochs landed.
pub async fn ingest_pending<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
) -> Result<u64, IngestError> {
    let cursor = mirror::last_ingested_epoch(pool).await?;
    let packages = boundary.epochs_since(cursor).await?;
    let mut landed = 0;
    for package in &packages {
        mirror::ingest_epoch(pool, package).await?;
        landed += 1;
        tracing::info!(
            epoch = package.epoch,
            records = package.records.len(),
            "epoch ingested into the mirror"
        );
    }
    Ok(landed)
}

/// The server's background ingestion loop: poll the seam on an interval.
/// The stand-in publishes on epoch close; the real substrate's cadence
/// arrives with the swap.
pub async fn ingest_loop<B: L1Boundary>(boundary: B, pool: PgPool, interval_secs: u64) {
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval_secs));
    loop {
        ticker.tick().await;
        if let Err(e) = ingest_pending(&boundary, &pool).await {
            tracing::error!(error = %e, "ingestion pass failed; will retry");
        }
    }
}
