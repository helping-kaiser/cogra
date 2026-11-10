//! ´mod:module:deletion´
//!
//! Account deletion's execution (erasure.md §5 step 4, §6): the deadline
//! executor that carries out a confirmed deletion once its seven-day grace
//! has passed, leaving the L1 husk — every record, the standing, the
//! title, the actor's key and address — with the names and words gone.
//!
//! **Three motions, each resumable** (the store half is
//! `postgres_store::deletion`):
//!
//! 1. **Claim** — one transaction, the point of no return: `executed_at`
//!    is stamped and the identity association forgotten (credentials
//!    redacted in place, sessions revoked, secrets, key backups, device
//!    locks and carried acts deleted). A cancel that loses the race to it
//!    finds nothing standing.
//! 2. **Redact** — every Registration act of the account, and with the
//!    content opt-in every post and comment chain it wrote, each act in
//!    its own transaction through the redaction substrate
//!    ([`crate::redaction`]): archive unit first, then the carriage
//!    reduction, the staged reap, the display tombstones and the media
//!    hold. The substrate's residue and the held bytes go after each
//!    commit.
//! 3. **Close** — the private per-user state, the profile tombstone and,
//!    last, the handle's redacted form, which marks the execution done.
//!
//! A crash anywhere between the claim and the close leaves an executed
//! row whose account still carries its handle; the next tick finishes it
//! before it claims anything new. Every step is idempotent, so finishing
//! is re-running from the start.
//!
//! **Nothing is authored, severed or deleted on the graph.** Payloads drop
//! to their reduced projection, Postgres rows are tombstoned or blanked in
//! place, and every removal leaves its mark: the reduced payload state,
//! the profile tombstone, the content tombstones read `by: ACCOUNT`.

use common::l1::census::Family;
use postgres_store::deletion::{self as store, Execution};
use postgres_store::removal::ACCOUNT_REMOVAL;
use postgres_store::{PgPool, auth as auth_store};
use uuid::Uuid;

use crate::l1::L1Boundary;
use crate::media::MediaAreas;
use crate::media::areas as media_areas;
use crate::redaction::{self, Redacted, Redaction, RedactionError};
use crate::removal::{self, RemovalError};

/// How many due deletions one tick claims. A deletion redacts every act
/// of its account one transaction at a time, so a tick stays bounded and
/// the next tick takes the rest; resumed executions are not counted.
pub const CLAIMS_PER_TICK: i64 = 16;

/// The content families the content-level sweep removes: posts and
/// comments. Send (chat messages) is the third content family erasure.md
/// names; the MVP writes none.
const CONTENT_FAMILIES: [Family; 2] = [Family::Publish, Family::Review];

/// Why an execution could not finish. The claim has committed by then, so
/// the account is executed either way, and the next tick resumes it.
#[derive(Debug, thiserror::Error)]
pub enum ExecutionError {
    #[error("redaction: {0}")]
    Redaction(#[from] RedactionError),
    #[error("removal: {0}")]
    Removal(#[from] RemovalError),
    #[error("storage: {0}")]
    Storage(#[from] sqlx::Error),
}

/// What one tick did.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Tick {
    /// Executions finished this tick that an earlier run had left open.
    pub resumed: Vec<Uuid>,
    /// Deletions claimed and finished this tick.
    pub executed: Vec<Uuid>,
    /// Accounts whose execution failed part-way; resumed next tick.
    pub failed: Vec<Uuid>,
}

/// What finishing one execution did.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Finished {
    /// The Registration acts reduced, oldest first.
    pub registration_acts: Vec<String>,
    /// The content acts the sweep removed.
    pub content_acts: Vec<String>,
    /// The profile tombstone was appended by this run.
    pub tombstoned: bool,
}

/// One executor tick: finish every execution an earlier run left open,
/// then claim and finish up to [`CLAIMS_PER_TICK`] due deletions. One
/// account's failure is logged and never blocks the others.
pub async fn tick<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    areas: &MediaAreas,
) -> Result<Tick, sqlx::Error> {
    let mut done = Tick::default();
    for execution in store::incomplete(pool).await? {
        match finish(boundary, pool, areas, &execution).await {
            Ok(_) => done.resumed.push(execution.user_id),
            Err(e) => {
                tracing::error!(account = %execution.user_id, error = %e, "resuming an account deletion failed");
                done.failed.push(execution.user_id);
            }
        }
    }
    for user_id in store::due(pool, CLAIMS_PER_TICK).await? {
        let Some(execution) = store::claim(pool, user_id).await? else {
            continue;
        };
        match finish(boundary, pool, areas, &execution).await {
            Ok(_) => done.executed.push(user_id),
            Err(e) => {
                tracing::error!(account = %user_id, error = %e, "an account deletion stopped part-way; the next tick resumes it");
                done.failed.push(user_id);
            }
        }
    }
    Ok(done)
}

/// Runs a claimed execution to its end: the identity level, the content
/// level when opted into, then the close. Safe to run again on an
/// execution already finished, or half-finished, by an earlier run.
pub async fn finish<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    areas: &MediaAreas,
    execution: &Execution,
) -> Result<Finished, ExecutionError> {
    let mut finished = Finished::default();
    if let Some(address) = execution.address.as_deref() {
        finished.registration_acts =
            redact_identity(boundary, pool, areas, execution.user_id, address).await?;
        if execution.include_content {
            finished.content_acts =
                sweep_content(boundary, pool, areas, execution.user_id, address).await?;
        }
    }
    let closed = store::close(pool, execution).await?;
    media_areas::hold_all(pool, areas, &closed.held_media).await;
    finished.tombstoned = closed.tombstoned;
    Ok(finished)
}

/// The identity level (erasure.md §2): every Registration act of the
/// account — the admission Registration with its handle, every profile
/// update, landed or in flight — reduced in its own transaction, its
/// profile rows blanked before the media hold so the avatar leaves the
/// live store once nothing shows it.
async fn redact_identity<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    areas: &MediaAreas,
    user_id: Uuid,
    address: &str,
) -> Result<Vec<String>, ExecutionError> {
    let acts = store::registration_acts(pool, user_id, address).await?;
    let redacted_by = user_id.to_string();
    let mut done: Vec<Redacted> = Vec::with_capacity(acts.len());
    for act in &acts {
        let r = Redaction {
            actor_id: user_id,
            act_id: &act.act_id,
            reason: ACCOUNT_REMOVAL,
            redacted_by: &redacted_by,
        };
        let mut tx = pool.begin().await?;
        let reduced = redaction::reduce_in(&mut tx, &r).await?;
        store::blank_profile_rows(&mut tx, user_id, &act.rows).await?;
        done.push(reduced.hold_in(&mut tx).await?);
        tx.commit().await?;
    }
    let ids: Vec<String> = acts.into_iter().map(|a| a.act_id).collect();
    redaction::release(boundary, pool, areas, &ids, &mut done).await?;
    Ok(ids)
}

/// The content level (erasure.md §2 "Content-level"): every post and
/// comment chain the account wrote, removed whole under the account
/// deletion's reason, so each reads `by: ACCOUNT`.
async fn sweep_content<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    areas: &MediaAreas,
    user_id: Uuid,
    address: &str,
) -> Result<Vec<String>, ExecutionError> {
    let nodes = store::authored_content_nodes(pool, user_id, address, &CONTENT_FAMILIES).await?;
    let mut acts = Vec::new();
    for n in nodes {
        let Some(family) = Family::parse(&n.family) else {
            continue;
        };
        let removed = removal::remove_authored_chain(
            boundary,
            pool,
            areas,
            user_id,
            address,
            family,
            &n.node,
            ACCOUNT_REMOVAL,
        )
        .await?;
        acts.extend(removed.acts);
    }
    Ok(acts)
}

/// The deadline executor's loop: one [`tick`] every `interval_secs`.
pub async fn executor_loop<B: L1Boundary>(
    boundary: B,
    pool: PgPool,
    areas: MediaAreas,
    interval_secs: u64,
) {
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval_secs));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        ticker.tick().await;
        match tick(&boundary, &pool, &areas).await {
            Ok(t) if t == Tick::default() => {}
            Ok(t) => tracing::info!(
                executed = t.executed.len(),
                resumed = t.resumed.len(),
                failed = t.failed.len(),
                "account deletions executed"
            ),
            Err(e) => tracing::error!(error = %e, "the account-deletion executor tick failed"),
        }
    }
}

/// Whether a request's access token still speaks for an account with a
/// login. An access token outlives a deletion's claim by up to its TTL;
/// the request resolution drops it, so nothing can be signed, written or
/// read as the executed account from the claim on. A store fault keeps
/// the viewer: every resolver behind it reads the same store and fails on
/// its own, and treating an outage as a sign-out would sign every client
/// out.
pub async fn viewer_has_login(pool: &PgPool, user_id: Uuid) -> bool {
    match auth_store::has_login(pool, user_id).await {
        Ok(live) => live,
        Err(e) => {
            tracing::warn!(error = %e, "viewer login check failed; keeping the viewer");
            true
        }
    }
}
