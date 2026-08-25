// The stance bundle fold (feed-ranking.md §3.2): the sum of one author's
// own parameters toward one node, per family. The clip that turns the sum
// into the folded pair is the read rule and lives with the math
// (common::l1::fold) — this module answers only the storage question.
//
// The bundle spans both halves of the write path. The landed half is the
// mirror; the pending half is the author's own staged writes from the
// pre-commitment onward, which the L2 view counts and the L1 view does not
// (api-spec.md "Conventions", the includePending split).

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
/// record count. `author_atom` is the author's L0 address atom; `target` is
/// the target's node identifier in its stored form.
///
/// Payload-marked records are excluded — folds read them individually,
/// "never through the author's netted bundle" (api-spec.md `Record.
/// payloadMarked`; the L1 exclusion list in layer1-interface.md §11.3).
/// Ballots are payload-marked Opinions toward a proposal anchor, so without
/// this a vote would silently move the voter's stance bundle.
pub async fn bundle(
    pool: &PgPool,
    author_atom: &str,
    family: Family,
    target: &str,
    view: BundleView,
) -> Result<BundleSum, sqlx::Error> {
    // The mirror keys legs by node identifier; the staged row keys by the
    // bare atom the proposal carries.
    let source = NodeId::Addr(author_atom.to_string()).to_string();
    let landed = sqlx::query!(
        r#"SELECT COALESCE(SUM(l.p_d), 0)::float8 AS "p_d!",
                  COALESCE(SUM(l.p_i), 0)::float8 AS "p_i!",
                  COUNT(*)::bigint              AS "records!"
           FROM mirror_record_legs l
           JOIN mirror_records r ON r.record_id = l.record_id
           WHERE l.leg = 'binary' AND l.family = $1
             AND l.source = $2 AND l.target = $3
             AND NOT r.payload_marked"#,
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
        // The author's own acts in flight. Landed and expired rows are
        // excluded: the first is already counted through the mirror, the
        // second never existed on the graph. An empty payload is what makes
        // a record unmarked once it lands, so the same exclusion applies
        // here — a staged ballot must not move the bundle either.
        let pending = sqlx::query!(
            r#"SELECT COALESCE(SUM(p_d), 0)::float8 AS "p_d!",
                      COALESCE(SUM(p_i), 0)::float8 AS "p_i!",
                      COUNT(*)::bigint             AS "records!"
               FROM staged_writes
               WHERE family = $1 AND author = $2 AND target = $3
                 AND middle IS NULL
                 AND octet_length(payload) = 0
                 AND pre_signed_at IS NOT NULL
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
