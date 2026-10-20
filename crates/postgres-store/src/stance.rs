//! ´mod:module:stance´
//!
//! The stance bundle fold (feed-ranking.md §3.2): the sum of one author's
//! own parameters toward one node, per family. The clip that turns the sum
//! into the folded pair is the read rule and lives with the math, in
//! `common::l1::fold` — this module answers only the storage question.
//!
//! The bundle spans both halves of the write path. The landed half is the
//! mirror; the pending half is the author's own staged writes from the
//! pre-commitment onward, which the L2 view counts and the L1 view does
//! not (api-spec.md "Conventions", the includePending split).

use common::l1::census::Family;
use common::l1::fold::BundleSum;
use common::l1::identifier::NodeId;
use sqlx::PgPool;

/// Which view of the graph a bundle read takes: L1's — only what has
/// landed — or L2's, which also counts the author's acts still in flight.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BundleView {
    Landed,
    IncludingPending,
}

impl BundleView {
    pub fn from_include_pending(include_pending: bool) -> Self {
        if include_pending {
            BundleView::IncludingPending
        } else {
            BundleView::Landed
        }
    }
}

/// One author's bundle toward one node: the raw parameter sums and the
/// record count. `author_atom` is the author's address atom; `target` is
/// the target's node identifier in its stored form.
///
/// Payload-marked records are excluded — folds read them individually,
/// "never through the author's netted bundle" (api-spec.md `Record.
/// payloadMarked`; the L1 exclusion list in layer1-interface.md §11.3).
/// Ballots are payload-marked Opinions toward a proposal anchor, so without
/// this a vote would silently move the voter's stance bundle.
///
/// The two halves are keyed differently: the mirror keys legs by node
/// identifier, the staged row by the bare atom a proposal carries. On the
/// pending half, landed and expired rows are excluded — the first is
/// already counted through the mirror, the second never existed on the
/// graph — and an empty payload stands in for the unmarked test, since an
/// empty payload is what makes a record unmarked once it lands. A pending
/// row counts from its pre-commitment, or from staging when it is an act
/// carried with the author's application: the applicant's stance faces
/// wear their carried pick (ApplicantFeed.md), and the pending half is
/// only ever its own author's read.
///
/// Census-unknown legs are excluded too. A leg the census has no spec for
/// carries fallback domain, mask and tier that ingestion invented, so its
/// parameters were never validated against the family they claim; summing
/// them into a stance would fold a guess into the number the read rule is
/// applied to.
pub async fn bundle(
    pool: &PgPool,
    author_atom: &str,
    family: Family,
    target: &str,
    view: BundleView,
) -> Result<BundleSum, sqlx::Error> {
    let source = NodeId::Addr(author_atom.to_string()).to_string();
    let landed = sqlx::query!(
        r#"SELECT COALESCE(SUM(l.p_d), 0)::float8 AS "p_d!",
                  COALESCE(SUM(l.p_i), 0)::float8 AS "p_i!",
                  COUNT(*)::bigint              AS "records!"
           FROM mirror_record_legs l
           JOIN mirror_records r ON r.record_id = l.record_id
           WHERE l.leg = 'binary' AND l.family = $1
             AND l.source = $2 AND l.target = $3
             AND NOT r.payload_marked
             AND NOT l.census_unknown"#,
        family.as_str(),
        source,
        target,
    )
    .fetch_one(pool)
    .await?;

    let mut sum = BundleSum {
        p_d: landed.p_d,
        p_i: landed.p_i,
        records: landed.records.max(0) as u32,
    };

    if view == BundleView::IncludingPending {
        let pending = sqlx::query!(
            r#"SELECT COALESCE(SUM(p_d), 0)::float8 AS "p_d!",
                      COALESCE(SUM(p_i), 0)::float8 AS "p_i!",
                      COUNT(*)::bigint             AS "records!"
               FROM staged_writes
               WHERE family = $1 AND author = $2 AND target = $3
                 AND middle IS NULL
                 AND octet_length(payload) = 0
                 AND (pre_signed_at IS NOT NULL OR carried)
                 AND state NOT IN ('landed', 'expired')"#,
            family.as_str(),
            author_atom,
            target,
        )
        .fetch_one(pool)
        .await?;
        sum.p_d += pending.p_d;
        sum.p_i += pending.p_i;
        sum.records += pending.records.max(0) as u32;
    }

    Ok(sum)
}

/// Whether the author holds at least one live outgoing Opinion edge: some
/// target whose netted bundle is not routing-inert, `p̄_d ≠ 0` and
/// `p̄_i ≠ 0` (edges.md §1) — the end of the borrowed view (api-spec.md
/// `Query.borrowedView`). An author whose Opinions are all inert, or all
/// netted to zero, has no such edge: their ranked feed would be empty.
///
/// The bundle is the fold of [`bundle`] — payload-marked and
/// census-unknown legs excluded — taken per target across every target
/// the author has written an Opinion toward. The clip preserves zero
/// (`clip(x) == 0` exactly when `x` is `0`), so the sum tests directly in
/// the query and `NetStance::is_inert` never needs the rows.
///
/// [`BundleView::Landed`] reads the mirror alone. [`BundleView::
/// IncludingPending`] adds the author's signed, in-flight Opinions into
/// the same per-target bundle — signed meaning the pre-commitment is in,
/// so a write still awaiting it carries no signature of the author's — and
/// an act carried with the application counts from the landing on, signed
/// or not: it signs with the vouch-in batch automatically (VouchBack.md:21).
/// Landed and expired staged rows are not counted as pending: the first is
/// in the mirror already, the second never existed on the graph.
pub async fn has_live_opinion_from(
    pool: &PgPool,
    author_atom: &str,
    view: BundleView,
) -> Result<bool, sqlx::Error> {
    let source = NodeId::Addr(author_atom.to_string()).to_string();
    sqlx::query_scalar!(
        r#"SELECT EXISTS(
               SELECT 1 FROM (
                   SELECT l.target, l.p_d, l.p_i
                   FROM mirror_record_legs l
                   JOIN mirror_records r ON r.record_id = l.record_id
                   WHERE l.leg = 'binary' AND l.family = 'opinion'
                     AND l.source = $1
                     AND NOT r.payload_marked
                     AND NOT l.census_unknown
                   UNION ALL
                   SELECT target, p_d, p_i
                   FROM staged_writes
                   WHERE $3 AND family = 'opinion' AND author = $2
                     AND middle IS NULL
                     AND octet_length(payload) = 0
                     AND (state NOT IN ('awaiting_pre_sign', 'expired', 'carried', 'landed')
                          OR (carried AND state = 'awaiting_pre_sign'))
               ) legs
               GROUP BY target
               HAVING SUM(p_d) <> 0 AND SUM(p_i) <> 0
           ) AS "exists!""#,
        source,
        author_atom,
        view == BundleView::IncludingPending,
    )
    .fetch_one(pool)
    .await
}

/// The author's own Publish bundle toward one minted Content node: the
/// raw `p_d` sums of every Publish-family record the author wrote toward
/// it, and how many records sum.
///
/// The sibling of [`bundle`] with the one difference that is the point of
/// it: payload-marked records are counted. Every Publish is payload-marked
/// — the genesis record and each edit carry the content envelope — so the
/// exclusion `bundle` applies, which keeps ballots out of a stance, would
/// empty this read. Census-unknown legs stay excluded for the same reason
/// as there, and the pending half counts the author's staged Publish rows
/// under the same lifecycle test (pre-committed or carried, neither landed
/// nor expired) with no empty-payload condition.
pub async fn publish_bundle(
    pool: &PgPool,
    author_atom: &str,
    target: &str,
    view: BundleView,
) -> Result<BundleSum, sqlx::Error> {
    let source = NodeId::Addr(author_atom.to_string()).to_string();
    let family = Family::Publish.as_str();
    let landed = sqlx::query!(
        r#"SELECT COALESCE(SUM(p_d), 0)::float8 AS "p_d!",
                  COALESCE(SUM(p_i), 0)::float8 AS "p_i!",
                  COUNT(*)::bigint             AS "records!"
           FROM mirror_record_legs
           WHERE leg = 'binary' AND family = $1
             AND source = $2 AND target = $3
             AND NOT census_unknown"#,
        family,
        source,
        target,
    )
    .fetch_one(pool)
    .await?;

    let mut sum = BundleSum {
        p_d: landed.p_d,
        p_i: landed.p_i,
        records: landed.records.max(0) as u32,
    };

    if view == BundleView::IncludingPending {
        let pending = sqlx::query!(
            r#"SELECT COALESCE(SUM(p_d), 0)::float8 AS "p_d!",
                      COALESCE(SUM(p_i), 0)::float8 AS "p_i!",
                      COUNT(*)::bigint             AS "records!"
               FROM staged_writes
               WHERE family = $1 AND author = $2 AND target = $3
                 AND middle IS NULL
                 AND (pre_signed_at IS NOT NULL OR carried)
                 AND state NOT IN ('landed', 'expired')"#,
            family,
            author_atom,
            target,
        )
        .fetch_one(pool)
        .await?;
        sum.p_d += pending.p_d;
        sum.p_i += pending.p_i;
        sum.records += pending.records.max(0) as u32;
    }

    Ok(sum)
}
