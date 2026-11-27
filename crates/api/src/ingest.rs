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
/// Epochs close on the clock, so the bound is a wall-time window: about
/// one hour at the stand-in's 3-second clock.
pub const DEFAULT_GC_AFTER_EPOCHS: i64 = 1_200;

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
/// landed and the mirror governs, so ingestion carries on and the next
/// pass re-runs the promotion of a content write or profile update — but
/// the failure rides the outcome instead of living only in the log, so
/// callers and tests can see it.
#[derive(Debug)]
pub struct PromotionFailure {
    /// Which promotion flow failed: `onboarding`, `content`, `profile`.
    pub stage: &'static str,
    pub staged: uuid::Uuid,
    pub act_id: String,
    pub error: String,
}

impl PromotionFailure {
    /// The failure of `stage`'s promotion of `write`.
    pub(crate) fn of(
        stage: &'static str,
        write: &staged::PromotedWrite,
        error: impl std::fmt::Display,
    ) -> Self {
        Self {
            stage,
            staged: write.id,
            act_id: write.act_id.clone(),
            error: error.to_string(),
        }
    }
}

/// Which promotion runs a landing.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Landing {
    /// The pass that marked the write landed.
    Confirm,
    /// A later pass re-running a promotion that never completed — the
    /// write was chosen for a pending row it still owns, so a row gone by
    /// now was promoted by another pass, and nothing is appended.
    Retry,
    /// A later pass re-running a promotion that never completed for a
    /// write chosen for owning no display row at all — it landed with its
    /// pending row already gone — so the insert branch runs, as on
    /// confirm.
    Rebuild,
}

impl Landing {
    /// Whether a landing that finds no row of its own to land appends one.
    pub(crate) fn inserts(self) -> bool {
        self != Self::Retry
    }
}

/// The stranded writes a pass retries: those an earlier pass marked
/// landed and never promoted, less this pass's own confirmations, which
/// its promotions have just run — a failure there is reported once, not
/// twice.
pub(crate) fn to_retry<'a>(
    stranded: &'a [staged::PromotedWrite],
    promoted: &'a [staged::PromotedWrite],
) -> impl Iterator<Item = &'a staged::PromotedWrite> {
    stranded
        .iter()
        .filter(|w| !promoted.iter().any(|p| p.id == w.id))
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
    /// Vouches this pass lapsed (`onboarding::lapse_dead_vouches`).
    pub lapsed: u64,
    /// The admission settlement pass that rode this ingestion pass.
    pub funding: crate::onboarding::SettlementOutcome,
}

/// Ingests every epoch published since the cursor, promoting staged
/// writes whose records land and collecting the ones that never will
/// (`gc_after_epochs` — an operational parameter, development.md).
/// Returns the promoted writes so flows built on confirmation (landing an
/// applicant, promoting display rows) can act on them.
///
/// Flow state advances here, on confirmation (architecture.md "The write
/// path" step 5): an applicant's ceremony lands, and a landed content record promotes its payload into carriage
/// and its display rows into view. Every ingestion path runs it — the
/// live loop, the dev CLI, and rebuilds alike — so a rebuild reconstructs
/// the same L2 state the live path produced. The entry ceremony's
/// landing is decided here for every account whose recorded vouch newly
/// confirmed (`onboarding::land_ready_accounts`), and after the GC its
/// collected vouches lapse (`onboarding::lapse_dead_vouches`). A landed
/// content write or profile update an earlier pass never promoted is
/// promoted here too (`content::land_stranded`, `profile::land_stranded`),
/// whether its display row is still pending or was never written: its
/// write is already landed, so no epoch returns it again.
///
/// The admission settlement pass rides last, on every pass whether or
/// not an epoch arrived (`onboarding::settle_admission_fundings`): a
/// burn settles on the realization's clock, not on CoGra's ingestion,
/// and a funding whose request was lost is re-requested there. Its own
/// failures ride the outcome and are retried by the next pass — the
/// mirror has already advanced by then.
pub async fn ingest_pending<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    gc_after_epochs: i64,
) -> Result<IngestOutcome, IngestError> {
    let cursor = mirror::last_ingested_epoch(pool).await?;
    repair_instants(boundary, pool, cursor).await?;
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
    let mut failures = crate::onboarding::land_ready_accounts(pool).await;
    failures.extend(crate::content::land_promoted(pool, &outcome.promoted).await);
    failures.extend(crate::profile::land_promoted(pool, &outcome.promoted).await);
    match crate::content::land_stranded(pool, &outcome.promoted).await {
        Ok(stranded) => failures.extend(stranded),
        Err(e) => tracing::error!(
            stage = "content",
            error = %e,
            "could not read the landed writes still pending; the next pass retries"
        ),
    }
    match crate::profile::land_stranded(pool, &outcome.promoted).await {
        Ok(stranded) => failures.extend(stranded),
        Err(e) => tracing::error!(
            stage = "profile",
            error = %e,
            "could not read the landed writes still pending; the next pass retries"
        ),
    }
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
    outcome.lapsed = crate::onboarding::lapse_dead_vouches(pool).await;
    outcome.funding = crate::onboarding::settle_admission_fundings(boundary, pool).await;
    Ok(outcome)
}

/// Fills the asserted instant of every ingested epoch that lacks one —
/// the epochs a mirror took in before the epoch package carried the
/// instant — from their published packages, read back through the seam.
/// A complete mirror costs one count; the repair reads the sequence once.
async fn repair_instants<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    cursor: i64,
) -> Result<(), IngestError> {
    let Some(from) = mirror::first_epoch_without_instant(pool).await? else {
        return Ok(());
    };
    let instants: Vec<_> = boundary
        .epochs_since(from - 1)
        .await?
        .into_iter()
        .filter(|package| package.epoch <= cursor)
        .map(|package| (package.epoch, package.asserted_at))
        .collect();
    let repaired = mirror::record_instants(pool, &instants).await?;
    tracing::info!(
        from,
        repaired,
        "mirror epoch instants filled from the published sequence"
    );
    Ok(())
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
