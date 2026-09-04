//! ´mod:module:references´
//!
//! The current-references fold (D4): net per
//! (author, citing artifact, target) bundle, same-author sum-then-clip, a
//! bundle netting to `(0,0)` dropped from the view.
//!
//! This is the census's own withdrawal rule — "withdrawal is per-leg net
//! stance" (layer1-interface.md §9.6) — and deliberately **not** the Tag
//! rule beside it. Tag withdrawal is newest-wins at relevance 0 precisely
//! because confidence is census-bounded to `c ∈ [0, 1]`, so no
//! counter-record could net an accumulated bundle back down (hashtag.md
//! §4). Both Reference parameters span `[−1, 1]`, so netting *is*
//! expressible here, and this module sums where `topics.rs` picks.
//!
//! The bundle key is the full incidence, not (author, target): "a
//! hyper-edge act is one cell, never two" (layer1-interface.md §11.3), so
//! the same author citing the same target from two different posts authors
//! two distinct bundles.
//!
//! # Which column carries relevance
//!
//! A Reference's act tuple is (relevance, support) — census (effort `f`,
//! enthusiasm `e`) — and the census transposes it on the T-leg
//! (`common::l1::census::leg_params`). The two halves of the write path
//! therefore store the same citation in *opposite* columns:
//!
//! | half                     | relevance (`f`) | support (`e`) |
//! |--------------------------|-----------------|---------------|
//! | landed T-leg (mirror)    | `p_i`           | `p_d`         |
//! | staged write (act tuple) | `p_d`           | `p_i`         |
//!
//! Reading the wrong one silently swaps every citation's relevance for its
//! support — a fold that still returns rows, just wrong ones, and on this
//! family the swapped axis is the one deciding whether a mention vouches.
//!
//! Only T-legs are read. The A-leg (author → artifact) carries the same
//! act and adds nothing this read needs: it identifies the author, and the
//! parent record is authoritative for that.
//!
//! Payload-marked records are excluded throughout — folds read them
//! individually, "never through the author's netted bundle" (api-spec.md
//! `Record.payloadMarked`).

use common::l1::fold::BundleSum;
use sqlx::PgPool;

/// The fold view a references read takes — see
/// [`crate::view::PendingView`], which every fold with a pending half
/// shares.
pub use crate::view::PendingView as ReferenceView;

/// One standing citation from an artifact, as one author's bundle nets it.
#[derive(Debug, Clone, PartialEq)]
pub struct ReferenceClaim {
    /// The cited target's L1 identifier, verbatim. Its class is the whole
    /// quote/embed/mention distinction (D2): `prof:` is a mention.
    pub target: String,
    /// The citing author's L0 address atom.
    pub author: String,
    /// Folded relevance — effort `f`, clipped to `[−1, 1]`.
    pub relevance: f64,
    /// Folded support — enthusiasm `e`, clipped to `[−1, 1]`.
    pub support: f64,
    /// How many records the bundle folds.
    pub records: u32,
    /// How many counter-records withdrawing this citation would stage —
    /// `⌈max(|Σ_d|, |Σ_i|)⌉`, one priced act each (B4).
    ///
    /// Read off the RAW sums, before the clip: the clip has already lost
    /// how far past `1` a bundle reaches, and that distance is exactly
    /// what decides whether one counter-record can walk it back. A claim
    /// clipped to `1.0` may cost one act to withdraw or five.
    pub withdrawal_cost: u32,
    /// True when any record in the bundle is still in flight.
    pub pending: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum ReferencesError {
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
}

/// The citations standing on one artifact, as one author declares them.
///
/// `author` is the artifact's own author for the reference row (D12): the
/// content-intrinsic channel, the one that needs no forward-path weight.
/// Third-party citations join in slice 3, alongside third-party topic
/// claims, once there is a weight to gate them with.
///
/// A bundle netting to `(0,0)` is dropped — that is what withdrawal looks
/// like on this family. A bundle inert on only one axis is kept: it still
/// stands, it simply routes nothing.
///
/// # The two halves filter on different actors
///
/// The landed half selects on `author`; the pending half selects on the
/// actor named by `view`, because a staged write is visible only to
/// whoever staged it. Count pending only when the two are the same actor.
pub async fn references_of(
    pool: &PgPool,
    artifact: &str,
    author: &str,
    view: ReferenceView<'_>,
) -> Result<Vec<ReferenceClaim>, ReferencesError> {
    let (with_pending, pending_actor) = view.params();
    let rows = sqlx::query!(
        r#"WITH candidates AS (
               SELECT l.target AS target,
                      l.p_i    AS relevance,
                      l.p_d    AS support,
                      FALSE    AS pending
               FROM mirror_record_legs l
               JOIN mirror_records r ON r.record_id = l.record_id
               WHERE l.leg = 't' AND l.family = 'reference'
                 AND l.source = $1
                 AND r.author = $2
                 AND NOT r.payload_marked
                 AND NOT l.census_unknown
             UNION ALL
               SELECT s.target, s.p_d, s.p_i, TRUE
               FROM staged_writes s
               WHERE $3
                 AND s.family = 'reference'
                 AND s.middle = $1
                 AND s.author = $4
                 AND octet_length(s.payload) = 0
                 AND s.pre_signed_at IS NOT NULL
                 AND s.state NOT IN ('landed', 'expired')
           )
           SELECT target                            AS "target!",
                  SUM(relevance)::float8            AS "relevance!",
                  SUM(support)::float8              AS "support!",
                  COUNT(*)::bigint                  AS "records!",
                  BOOL_OR(pending)                  AS "pending!"
           FROM candidates
           GROUP BY target
           ORDER BY target"#,
        artifact,
        author,
        with_pending,
        pending_actor,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .filter_map(|r| {
            let sum = BundleSum {
                p_d: r.relevance,
                p_i: r.support,
                records: r.records.max(0) as u32,
            };
            let net = sum.fold();
            if net.is_severed() {
                return None;
            }
            Some(ReferenceClaim {
                target: r.target,
                author: author.to_string(),
                relevance: net.p_d,
                support: net.p_i,
                records: sum.records,
                withdrawal_cost: sum.severance_cost().try_into().unwrap_or(u32::MAX),
                pending: r.pending,
            })
        })
        .collect())
}

/// One author's citation bundle from one artifact toward one target: the
/// raw parameter sums in **act-tuple** space, before the clip.
///
/// The sum is the storage question and the clip is the read rule
/// (`common::l1::fold`), so this returns raw sums — withdrawal needs that
/// distinction, because a bundle is netted when its *sum* reaches zero and
/// a clipped sum has already lost how far away that is.
pub async fn bundle(
    pool: &PgPool,
    author: &str,
    artifact: &str,
    target: &str,
    view: ReferenceView<'_>,
) -> Result<BundleSum, ReferencesError> {
    let (with_pending, pending_actor) = view.params();
    let row = sqlx::query!(
        r#"WITH candidates AS (
               SELECT l.p_i AS relevance,
                      l.p_d AS support
               FROM mirror_record_legs l
               JOIN mirror_records r ON r.record_id = l.record_id
               WHERE l.leg = 't' AND l.family = 'reference'
                 AND l.source = $1
                 AND l.target = $2
                 AND r.author = $3
                 AND NOT r.payload_marked
                 AND NOT l.census_unknown
             UNION ALL
               SELECT s.p_d, s.p_i
               FROM staged_writes s
               WHERE $4
                 AND s.family = 'reference'
                 AND s.middle = $1
                 AND s.target = $2
                 AND s.author = $5
                 AND octet_length(s.payload) = 0
                 AND s.pre_signed_at IS NOT NULL
                 AND s.state NOT IN ('landed', 'expired')
           )
           SELECT COALESCE(SUM(relevance), 0)::float8 AS "p_d!",
                  COALESCE(SUM(support), 0)::float8   AS "p_i!",
                  COUNT(*)::bigint                    AS "records!"
           FROM candidates"#,
        artifact,
        target,
        author,
        with_pending,
        pending_actor,
    )
    .fetch_one(pool)
    .await?;

    Ok(BundleSum {
        p_d: row.p_d,
        p_i: row.p_i,
        records: row.records.max(0) as u32,
    })
}
