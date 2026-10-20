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
        r#"SELECT COALESCE(SUM(l.p_d::text::numeric), 0)::text AS "p_d!",
                  COALESCE(SUM(l.p_i::text::numeric), 0)::text AS "p_i!",
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
    }

    Ok(sum.bundle())
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
