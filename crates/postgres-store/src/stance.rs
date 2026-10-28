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
use common::l1::exact::Decimal;
use common::l1::fold::{BundleSum, Standing};
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

/// One author's bundle toward one node, read as a standing: the raw
/// parameter sums, the record count, and whether the newest record says
/// something (`common::l1::fold::Standing`, which reads the bundle
/// severed or saying nothing from it). `author_atom` is the author's
/// address atom; `target` is the target's node identifier in its stored
/// form.
///
/// The newest record is the last in the published order — the causal key
/// `(epoch, act_time, position)` the chronicle pages on — and with the
/// pending half counted, the author's newest act in flight, by its act
/// sequence: an act still in flight lands after everything already
/// landed, so it is the newest the bundle will hold.
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
pub async fn standing(
    pool: &PgPool,
    author_atom: &str,
    family: Family,
    target: &str,
    view: BundleView,
) -> Result<Standing, sqlx::Error> {
    let source = NodeId::Addr(author_atom.to_string()).to_string();
    let landed = sqlx::query!(
        r#"SELECT COALESCE(SUM(l.p_d::text::numeric), 0)::text AS "p_d!",
                  COALESCE(SUM(l.p_i::text::numeric), 0)::text AS "p_i!",
                  COUNT(*)::bigint              AS "records!",
                  COALESCE((ARRAY_AGG(NOT (l.p_d = 0 AND l.p_i = 0)
                                      ORDER BY r.epoch DESC, r.act_time DESC,
                                               r.position DESC))[1],
                           FALSE)               AS "newest_says!"
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

    let mut sum = ExactSums::default();
    sum.absorb(&landed.p_d, &landed.p_i, landed.records)?;
    let mut newest_says_something = landed.newest_says;

    if view == BundleView::IncludingPending {
        let pending = sqlx::query!(
            r#"SELECT COALESCE(SUM(p_d::text::numeric), 0)::text AS "p_d!",
                      COALESCE(SUM(p_i::text::numeric), 0)::text AS "p_i!",
                      COUNT(*)::bigint             AS "records!",
                      (ARRAY_AGG(NOT (p_d = 0 AND p_i = 0) ORDER BY seq DESC))[1]
                                                   AS "newest_says?"
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
        sum.absorb(&pending.p_d, &pending.p_i, pending.records)?;
        if let Some(says) = pending.newest_says {
            newest_says_something = says;
        }
    }

    Ok(Standing {
        sum: sum.bundle(),
        newest_says_something,
    })
}

/// For each of the given records that folds into a stance bundle — a
/// binary Opinion or Affinity, unmarked, its leg census-known — whether it
/// left that bundle severed: the record says something, and the bundle as
/// of it — every record of the same author, family and target up to and
/// including this one in the published order — nets to exactly `(0, 0)`.
/// That is `Standing::is_severed` read at the record, so the newest
/// record's answer is the landed bundle's. Records that fold into no
/// stance bundle are absent from the map.
///
/// The row's half of the bundle's reading: a row draws one record's pair
/// without the bundle, and the flag is what tells a walk-back from a
/// record that says nothing (api-spec.md `Record.severed`).
pub async fn severing_records(
    pool: &PgPool,
    record_ids: &[String],
) -> Result<std::collections::HashMap<String, bool>, sqlx::Error> {
    Ok(sqlx::query!(
        r#"SELECT l.record_id AS "record_id!",
                  (NOT (l.p_d = 0 AND l.p_i = 0)
                   AND prefix.p_d = 0 AND prefix.p_i = 0) AS "severed!"
           FROM mirror_record_legs l
           JOIN mirror_records r ON r.record_id = l.record_id
           CROSS JOIN LATERAL (
               SELECT COALESCE(SUM(b.p_d::text::numeric), 0) AS p_d,
                      COALESCE(SUM(b.p_i::text::numeric), 0) AS p_i
               FROM mirror_record_legs b
               JOIN mirror_records br ON br.record_id = b.record_id
               WHERE b.leg = 'binary' AND b.family = l.family
                 AND b.source = l.source AND b.target = l.target
                 AND NOT br.payload_marked
                 AND NOT b.census_unknown
                 AND (br.epoch, br.act_time, br.position)
                     <= (r.epoch, r.act_time, r.position)
           ) prefix
           WHERE l.record_id = ANY($1)
             AND l.leg = 'binary' AND l.family IN ('opinion', 'affinity')
             AND NOT r.payload_marked
             AND NOT l.census_unknown"#,
        record_ids,
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|row| (row.record_id, row.severed))
    .collect())
}

/// The given records a walk-back signed (api-spec.md `RecordAct.WALK_BACK`):
/// the record that brought its stance bundle back to `(0, 0)` and, for a
/// severance batch, every record of the batch — the reading of
/// [`common::l1::fold::walk_back_records`], applied to each bundle a given
/// record folds into.
///
/// The bundles are [`severing_records`]' — a binary Opinion or Affinity,
/// unmarked, its leg census-known, keyed (author, family, target) — read
/// whole in the published order, because whether a record belongs to a
/// batch depends on the records before it. One round trip for every bundle
/// the given records touch; a record that folds into no stance bundle is
/// never a walk-back.
pub async fn walk_back_records(
    pool: &PgPool,
    record_ids: &[String],
) -> Result<std::collections::HashSet<String>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"WITH bundles AS (
               SELECT DISTINCT l.family, l.source, l.target
               FROM mirror_record_legs l
               JOIN mirror_records r ON r.record_id = l.record_id
               WHERE l.record_id = ANY($1)
                 AND l.leg = 'binary' AND l.family IN ('opinion', 'affinity')
                 AND NOT r.payload_marked
                 AND NOT l.census_unknown
           )
           SELECT b.record_id AS "record_id!", b.family AS "family!",
                  b.source AS "source!", b.target AS "target!",
                  b.p_d AS "p_d!", b.p_i AS "p_i!"
           FROM bundles k
           JOIN mirror_record_legs b
             ON b.leg = 'binary' AND b.family = k.family
            AND b.source = k.source AND b.target = k.target
           JOIN mirror_records br ON br.record_id = b.record_id
           WHERE NOT br.payload_marked
             AND NOT b.census_unknown
           ORDER BY b.family, b.source, b.target,
                    br.epoch, br.act_time, br.position"#,
        record_ids,
    )
    .fetch_all(pool)
    .await?;
    let wanted: std::collections::HashSet<&str> = record_ids.iter().map(String::as_str).collect();
    let mut found = std::collections::HashSet::new();
    for bundle in
        rows.chunk_by(|a, b| (&a.family, &a.source, &a.target) == (&b.family, &b.source, &b.target))
    {
        let pairs: Vec<(f64, f64)> = bundle.iter().map(|row| (row.p_d, row.p_i)).collect();
        let marks = common::l1::fold::walk_back_records(&pairs)
            .map_err(|e| sqlx::Error::Decode(Box::new(e)))?;
        found.extend(
            bundle
                .iter()
                .zip(marks)
                .filter(|(row, walked)| *walked && wanted.contains(row.record_id.as_str()))
                .map(|(row, _)| row.record_id.clone()),
        );
    }
    Ok(found)
}

/// Whether the author holds at least one live outgoing Opinion edge: some
/// target whose netted bundle is not routing-inert, `p̄_d ≠ 0` and
/// `p̄_i ≠ 0` (edges.md §1) — the end of the borrowed view (api-spec.md
/// `Query.borrowedView`). An author whose Opinions are all inert, or all
/// netted to zero, has no such edge: their ranked feed would be empty.
///
/// The bundle is the fold of [`standing`] — payload-marked and
/// census-unknown legs excluded — taken per target across every target
/// the author has written an Opinion toward. The clip preserves zero
/// (`clip(x) == 0` exactly when `x` is `0`), so the sum tests directly in
/// the query and `NetStance::is_inert` never needs the rows. The sums are
/// exact decimal, as `ExactSums` documents, so a bundle walked back to
/// zero reads inert here exactly when the stance read says it is.
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
               HAVING SUM(p_d::text::numeric) <> 0 AND SUM(p_i::text::numeric) <> 0
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
/// The sibling of [`standing`] with the one difference that is the point of
/// it: payload-marked records are counted. Every Publish is payload-marked
/// — the genesis record and each edit carry the content envelope — so the
/// exclusion `standing` applies, which keeps ballots out of a stance, would
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
        r#"SELECT COALESCE(SUM(p_d::text::numeric), 0)::text AS "p_d!",
                  COALESCE(SUM(p_i::text::numeric), 0)::text AS "p_i!",
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

    let mut sum = ExactSums::default();
    sum.absorb(&landed.p_d, &landed.p_i, landed.records)?;

    if view == BundleView::IncludingPending {
        let pending = sqlx::query!(
            r#"SELECT COALESCE(SUM(p_d::text::numeric), 0)::text AS "p_d!",
                      COALESCE(SUM(p_i::text::numeric), 0)::text AS "p_i!",
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
        sum.absorb(&pending.p_d, &pending.p_i, pending.records)?;
    }

    Ok(sum.bundle())
}

/// Where a held-topics page resumes: the folded association of the row it
/// resumes from, as the exact decimal the order compared, and that row's
/// canonical name, which breaks ties.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HeldCursor {
    pub association: String,
    pub name: String,
}

/// One Type the author holds: its canonical name, the bundle's sums, and
/// whether any record in it is still in flight.
#[derive(Debug, Clone, PartialEq)]
pub struct HeldTopic {
    /// The canonical name — the `name(s)` atom, lowercase, no `#`.
    pub name: String,
    pub sum: BundleSum,
    /// The folded association the order compares, as exact decimal text —
    /// what the next page's cursor carries back.
    pub association: String,
    pub pending: bool,
}

impl HeldTopic {
    pub fn cursor(&self) -> HeldCursor {
        HeldCursor {
            association: self.association.clone(),
            name: self.name.clone(),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum HeldError {
    /// A stored Affinity leg whose target is not a `name(s)` identifier.
    /// The census fixes an Affinity's target to a Type, so this means the
    /// mirror itself is corrupt.
    #[error("affinity leg targets `{0}`, which is not a Type identifier")]
    NotATypeTarget(String),
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
}

/// The Types the author holds (api-spec.md `User.heldTopics`): every
/// Affinity bundle of theirs whose sums are not exactly `(0, 0)`, the
/// [`standing`] fold taken across every Type at once — the same legs, the
/// same exclusions, the same pending half. A bundle walked back to
/// `(0, 0)` is not held; one at zero on a single axis still is, and so is
/// one held against.
///
/// Strongest first, by association: the folded `p_d` descending, then the
/// name ascending in byte order, so the order is total and a cursor is a
/// position. The fold's clip is applied to the exact sum in SQL —
/// `LEAST(GREATEST(Σ, -1), 1)` on `numeric` — so two bundles past the
/// same bound tie exactly as their folded pairs do, and the cursor
/// carries the compared value back as text, never through a float.
///
/// `backward` pages toward the head (`last`/`before`); rows still come
/// back in the list's own order. Paging is over a fold, not a table: a
/// stance the author changes between two pages moves its row, which the
/// list's next read shows (api-spec.md "A page is a snapshot").
pub async fn held_topics(
    pool: &PgPool,
    author_atom: &str,
    view: BundleView,
    cursor: Option<&HeldCursor>,
    backward: bool,
    limit: i64,
) -> Result<Vec<HeldTopic>, HeldError> {
    let source = NodeId::Addr(author_atom.to_string()).to_string();
    let (association, name) = match cursor {
        Some(c) => (Some(c.association.as_str()), Some(c.name.as_str())),
        None => (None, None),
    };
    let rows = sqlx::query!(
        r#"WITH legs AS (
               SELECT l.target, l.p_d::text::numeric AS p_d,
                      l.p_i::text::numeric AS p_i, FALSE AS pending
               FROM mirror_record_legs l
               JOIN mirror_records r ON r.record_id = l.record_id
               WHERE l.leg = 'binary' AND l.family = 'affinity'
                 AND l.source = $1
                 AND NOT r.payload_marked
                 AND NOT l.census_unknown
               UNION ALL
               SELECT target, p_d::text::numeric, p_i::text::numeric, TRUE
               FROM staged_writes
               WHERE $2 AND family = 'affinity' AND author = $3
                 AND middle IS NULL
                 AND octet_length(payload) = 0
                 AND (pre_signed_at IS NOT NULL OR carried)
                 AND state NOT IN ('landed', 'expired')
           ), held AS (
               SELECT target COLLATE "C" AS target,
                      SUM(p_d) AS sum_d, SUM(p_i) AS sum_i,
                      COUNT(*) AS records, BOOL_OR(pending) AS pending,
                      LEAST(GREATEST(SUM(p_d), -1), 1) AS association
               FROM legs
               GROUP BY target
               HAVING NOT (SUM(p_d) = 0 AND SUM(p_i) = 0)
           )
           SELECT target AS "target!", sum_d::text AS "sum_d!",
                  sum_i::text AS "sum_i!", records AS "records!",
                  pending AS "pending!", association::text AS "association!"
           FROM held
           WHERE $4::text IS NULL
              OR (NOT $6 AND (association < $4::text::numeric
                              OR (association = $4::text::numeric
                                  AND target > ('name:' || $5::text) COLLATE "C")))
              OR ($6 AND (association > $4::text::numeric
                          OR (association = $4::text::numeric
                              AND target < ('name:' || $5::text) COLLATE "C")))
           ORDER BY CASE WHEN $6 THEN association END ASC,
                    CASE WHEN $6 THEN target END DESC,
                    CASE WHEN NOT $6 THEN association END DESC,
                    CASE WHEN NOT $6 THEN target END ASC
           LIMIT $7"#,
        source,
        view == BundleView::IncludingPending,
        author_atom,
        association,
        name,
        backward,
        limit,
    )
    .fetch_all(pool)
    .await?;

    let mut held = Vec::with_capacity(rows.len());
    for row in rows {
        let name = row
            .target
            .strip_prefix("name:")
            .ok_or_else(|| HeldError::NotATypeTarget(row.target.clone()))?
            .to_string();
        let mut sum = ExactSums::default();
        sum.absorb(&row.sum_d, &row.sum_i, row.records)?;
        held.push(HeldTopic {
            name,
            sum: sum.bundle(),
            association: row.association,
            pending: row.pending,
        });
    }
    if backward {
        held.reverse();
    }
    Ok(held)
}

/// How many Types the author holds — [`held_topics`]' whole length, the
/// count Explore's Your topics door reads.
pub async fn count_held_topics(
    pool: &PgPool,
    author_atom: &str,
    view: BundleView,
) -> Result<i64, sqlx::Error> {
    let source = NodeId::Addr(author_atom.to_string()).to_string();
    sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "n!" FROM (
               SELECT target
               FROM (
                   SELECT l.target, l.p_d, l.p_i
                   FROM mirror_record_legs l
                   JOIN mirror_records r ON r.record_id = l.record_id
                   WHERE l.leg = 'binary' AND l.family = 'affinity'
                     AND l.source = $1
                     AND NOT r.payload_marked
                     AND NOT l.census_unknown
                   UNION ALL
                   SELECT target, p_d, p_i
                   FROM staged_writes
                   WHERE $2 AND family = 'affinity' AND author = $3
                     AND middle IS NULL
                     AND octet_length(payload) = 0
                     AND (pre_signed_at IS NOT NULL OR carried)
                     AND state NOT IN ('landed', 'expired')
               ) legs
               GROUP BY target
               HAVING NOT (SUM(p_d::text::numeric) = 0 AND SUM(p_i::text::numeric) = 0)
           ) held"#,
        source,
        view == BundleView::IncludingPending,
        author_atom,
    )
    .fetch_one(pool)
    .await
}

/// A bundle's exact sums as SQL assembles them, in halves.
///
/// Every sum in this crate is `SUM(x::text::numeric)`: the float8's text
/// is its shortest round-trip decimal — "the shortest precise decimal
/// representation" whenever `extra_float_digits` is above 0, which sqlx
/// sets to 3 on connect — and `numeric` addition is exact ("calculations
/// with numeric values yield exact results where possible, e.g. addition",
/// PostgreSQL docs, datatype-numeric). That is the decimal
/// `common::l1::exact` sums on the Rust side, so the store, the ranker and
/// the projection net the same records to the same value in any order. A
/// sum leaves as text — float8 would round it, and a sum too small for a
/// double is refused by float8 rather than carried — and the halves add
/// exactly here.
#[derive(Debug, Default)]
pub(crate) struct ExactSums {
    p_d: Decimal,
    p_i: Decimal,
    records: u32,
}

impl ExactSums {
    pub(crate) fn absorb(&mut self, p_d: &str, p_i: &str, records: i64) -> Result<(), sqlx::Error> {
        self.p_d = &self.p_d + &decimal(p_d)?;
        self.p_i = &self.p_i + &decimal(p_i)?;
        self.records = self
            .records
            .saturating_add(u32::try_from(records.max(0)).unwrap_or(u32::MAX));
        Ok(())
    }

    pub(crate) fn bundle(&self) -> BundleSum {
        BundleSum::from_decimals(&self.p_d, &self.p_i, self.records)
    }
}

/// A `numeric` sum's text as an exact decimal.
pub(crate) fn decimal(text: &str) -> Result<Decimal, sqlx::Error> {
    text.parse::<Decimal>()
        .map_err(|e| sqlx::Error::Decode(Box::new(e)))
}
