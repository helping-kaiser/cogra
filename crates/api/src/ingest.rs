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

/// How long the server's loop lets passes that ingest no epoch skip the
/// stranded checks (`content::land_stranded`, `profile::land_stranded`),
/// in seconds; overridden by L1_STRANDED_CHECK_INTERVAL_SECS
/// (development.md).
///
/// The checks read every landed write until a write carries a mark of its
/// own promotion, and the loop ticks every two seconds, so an idle server
/// paid that read on every tick for nothing. A write is left stranded only
/// by a pass that ingested an epoch, one that failed, or a process that
/// ended mid-pass — and the loop checks on each of those passes, or the
/// pass after — so this bound is the backstop for anything else, not the
/// path by which a stranded write is found.
pub const DEFAULT_STRANDED_CHECK_SECS: u64 = 60;

/// Whether a pass runs the stranded checks.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StrandedChecks {
    /// On every pass: what a direct call of [`ingest_pending`] gets, so
    /// one call heals.
    Always,
    /// Only on a pass that ingests an epoch: the server loop's idle tick
    /// inside its interval ([`StrandedCadence`]).
    WithEpochs,
}

/// The server loop's memory between passes for the stranded checks: when
/// they last ran, whether the last pass failed, and how many passes ran
/// them. A process starts with no memory, so its first pass checks.
#[derive(Debug)]
pub struct StrandedCadence {
    interval: std::time::Duration,
    last_checked: Option<std::time::Instant>,
    retry: bool,
    checks_run: u64,
}

impl StrandedCadence {
    /// A cadence that lets idle passes skip the checks for `interval`
    /// after a pass that ran them.
    pub fn new(interval: std::time::Duration) -> Self {
        Self {
            interval,
            last_checked: None,
            retry: false,
            checks_run: 0,
        }
    }

    /// What a pass starting at `now` runs: every check on the first pass,
    /// after a failed one, or once the interval has passed; otherwise only
    /// with an epoch.
    pub fn checks_at(&self, now: std::time::Instant) -> StrandedChecks {
        let due = self.retry
            || self
                .last_checked
                .is_none_or(|at| now.saturating_duration_since(at) >= self.interval);
        if due {
            StrandedChecks::Always
        } else {
            StrandedChecks::WithEpochs
        }
    }

    /// Records the pass that started at `now`: its outcome, or `None` when
    /// it returned an error. A failed promotion, a stranded read that
    /// failed, or a failed pass makes the next pass check.
    pub fn record(&mut self, now: std::time::Instant, outcome: Option<&IngestOutcome>) {
        if outcome.is_some_and(|o| o.stranded_checked) {
            self.last_checked = Some(now);
            self.checks_run += 1;
        }
        self.retry =
            outcome.is_none_or(|o| !o.promotion_failures.is_empty() || o.stranded_unread);
    }

    /// How many recorded passes ran the stranded checks.
    pub fn checks_run(&self) -> u64 {
        self.checks_run
    }
}

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
    /// Whether this pass ran the stranded checks ([`StrandedChecks`]).
    pub stranded_checked: bool,
    /// Whether a stranded check could not read its writes; they are
    /// logged, not failures of a write, so they ride here.
    pub stranded_unread: bool,
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
///
/// Runs the stranded checks on every call; the server loop paces them
/// through [`ingest_pass`].
pub async fn ingest_pending<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    gc_after_epochs: i64,
) -> Result<IngestOutcome, IngestError> {
    ingest_pass(boundary, pool, gc_after_epochs, StrandedChecks::Always).await
}

/// [`ingest_pending`] with the stranded checks run as `checks` says —
/// always, or only when the pass ingests an epoch. Everything else runs
/// on every pass.
pub async fn ingest_pass<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    gc_after_epochs: i64,
    checks: StrandedChecks,
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
    {
        let _ = checks;
        outcome.stranded_checked = true;
        match crate::content::land_stranded(pool, &outcome.promoted).await {
            Ok(stranded) => failures.extend(stranded),
            Err(e) => {
                outcome.stranded_unread = true;
                tracing::error!(
                    stage = "content",
                    error = %e,
                    "could not read the landed writes still pending; the next pass retries"
                );
            }
        }
        match crate::profile::land_stranded(pool, &outcome.promoted).await {
            Ok(stranded) => failures.extend(stranded),
            Err(e) => {
                outcome.stranded_unread = true;
                tracing::error!(
                    stage = "profile",
                    error = %e,
                    "could not read the landed writes still pending; the next pass retries"
                );
            }
        }
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
/// arrives with the swap. The stranded checks follow a
/// [`StrandedCadence`] of `stranded_check_secs`.
pub async fn ingest_loop<B: L1Boundary>(
    boundary: B,
    pool: PgPool,
    interval_secs: u64,
    stranded_check_secs: u64,
    gc_after_epochs: i64,
) {
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval_secs));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    let mut cadence = StrandedCadence::new(std::time::Duration::from_secs(stranded_check_secs));
    loop {
        ticker.tick().await;
        let now = std::time::Instant::now();
        match ingest_pass(&boundary, &pool, gc_after_epochs, cadence.checks_at(now)).await {
            Ok(outcome) => cadence.record(now, Some(&outcome)),
            Err(e) => {
                tracing::error!(error = %e, "ingestion pass failed; will retry");
                cadence.record(now, None);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    const INTERVAL: Duration = Duration::from_secs(60);

    fn checked() -> IngestOutcome {
        IngestOutcome {
            stranded_checked: true,
            ..IngestOutcome::default()
        }
    }

    fn failure() -> PromotionFailure {
        PromotionFailure {
            stage: "content",
            staged: uuid::Uuid::nil(),
            act_id: "act".into(),
            error: "refused".into(),
        }
    }

    /// The first pass of a process runs every stranded check.
    /// ´claim:ingest:the-first-pass-runs-the-stranded-checks´
    #[test]
    fn the_first_pass_of_a_process_runs_the_stranded_checks() {
        let cadence = StrandedCadence::new(INTERVAL);
        assert_eq!(cadence.checks_at(Instant::now()), StrandedChecks::Always);
    }

    /// An idle pass inside the interval after a clean checked pass runs the stranded checks only with an epoch.
    /// ´claim:ingest:an-idle-pass-inside-the-interval-skips-the-stranded-checks´
    #[test]
    fn an_idle_pass_inside_the_interval_skips_the_stranded_checks() {
        let start = Instant::now();
        let mut cadence = StrandedCadence::new(INTERVAL);
        cadence.record(start, Some(&checked()));
        let inside = start + INTERVAL - Duration::from_secs(1);
        assert_eq!(cadence.checks_at(inside), StrandedChecks::WithEpochs);
    }

    /// Once the interval has passed since the last checked pass, the next pass runs every stranded check.
    /// ´claim:ingest:the-interval-bounds-how-long-the-stranded-checks-wait´
    #[test]
    fn a_pass_once_the_interval_has_passed_runs_the_stranded_checks() {
        let start = Instant::now();
        let mut cadence = StrandedCadence::new(INTERVAL);
        cadence.record(start, Some(&checked()));
        cadence.record(start + Duration::from_secs(2), Some(&IngestOutcome::default()));
        assert_eq!(cadence.checks_at(start + INTERVAL), StrandedChecks::Always);
    }

    /// The pass after one whose promotion failed, whose stranded read failed, or which failed whole runs every stranded check.
    /// ´claim:ingest:the-pass-after-a-failure-runs-the-stranded-checks´
    #[test]
    fn the_pass_after_a_failure_runs_the_stranded_checks() {
        let start = Instant::now();
        let soon = start + Duration::from_secs(2);
        let failed_promotion = IngestOutcome {
            promotion_failures: vec![failure()],
            ..IngestOutcome::default()
        };
        let unread = IngestOutcome {
            stranded_checked: true,
            stranded_unread: true,
            ..IngestOutcome::default()
        };
        for outcome in [Some(&failed_promotion), Some(&unread), None] {
            let mut cadence = StrandedCadence::new(INTERVAL);
            cadence.record(start, Some(&checked()));
            cadence.record(start, outcome);
            assert_eq!(
                cadence.checks_at(soon),
                StrandedChecks::Always,
                "after {outcome:?}"
            );
        }
    }

    /// The count of checked passes moves only on a pass that ran the stranded checks.
    /// ´claim:ingest:the-cadence-counts-only-checked-passes´
    #[test]
    fn the_cadence_counts_only_the_passes_that_checked() {
        let start = Instant::now();
        let mut cadence = StrandedCadence::new(INTERVAL);
        cadence.record(start, Some(&checked()));
        cadence.record(start, Some(&IngestOutcome::default()));
        cadence.record(start, None);
        assert_eq!(cadence.checks_run(), 1);
    }
}
