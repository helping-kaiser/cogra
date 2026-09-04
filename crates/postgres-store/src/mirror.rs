//! ´mod:module:mirror´
//!
//! The record mirror: appends published epoch packages and advances the
//! epoch cursor in one transaction (data-model.md "The record mirror";
//! architecture.md "Record ingestion").
//!
//! The mirror may lag L1, must never diverge, and is fully rebuildable
//! from the published ordered sequence — nothing here is authoritative and
//! no row is ever precious.

use common::l1::census::Family;
use common::l1::handshake::EpochPackage;

use sqlx::PgPool;

#[derive(Debug, thiserror::Error)]
pub enum MirrorError {
    /// Ingestion is strictly sequential: the next epoch is cursor + 1.
    #[error("epoch {got} does not follow the cursor ({cursor})")]
    OutOfOrder { got: i64, cursor: i64 },
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
}

/// The last fully-ingested epoch; -1 when nothing has been ingested.
pub async fn last_ingested_epoch(pool: &PgPool) -> Result<i64, MirrorError> {
    Ok(
        sqlx::query_scalar!("SELECT last_epoch FROM mirror_epoch_cursor WHERE singleton")
            .fetch_one(pool)
            .await?,
    )
}

/// Appends one published epoch and advances the cursor, atomically. The
/// cursor is re-read under the transaction so concurrent ingestors cannot
/// double-append.
///
/// A leg's domain, mask, and tier are family-fixed and come from the
/// census, never from the package (`common::l1::census`). A leg the census
/// does not describe cannot occur in a census-valid package; one that
/// appears is ingested with minimal fallback metadata and logged loudly,
/// because a published record is never dropped.
///
/// It is also *marked*. Fallback metadata is invented, and the mirror is
/// the store that must never diverge, so the invention has to be a fact a
/// reader can see rather than a value indistinguishable from census
/// truth: parameter folds skip a marked leg and the record read carries
/// the mark. Ingestion still never stalls on one.
pub async fn ingest_epoch(pool: &PgPool, package: &EpochPackage) -> Result<(), MirrorError> {
    let mut tx = pool.begin().await?;
    let cursor = sqlx::query_scalar!(
        "SELECT last_epoch FROM mirror_epoch_cursor WHERE singleton FOR UPDATE"
    )
    .fetch_one(&mut *tx)
    .await?;
    if package.epoch != cursor + 1 {
        return Err(MirrorError::OutOfOrder {
            got: package.epoch,
            cursor,
        });
    }
    for record in &package.records {
        sqlx::query!(
            "INSERT INTO mirror_records
                 (record_id, family, author, epoch, act_time, position,
                  payload_marked, payload_witness)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            record.act_id.to_string(),
            record.family.as_str(),
            record.author,
            record.epoch,
            record.act_time,
            record.position,
            record.payload_marked,
            &record.payload_witness,
        )
        .execute(&mut *tx)
        .await?;
        for leg in &record.legs {
            let spec = record
                .family
                .legs()
                .iter()
                .find(|s| s.role == leg.role)
                .copied();
            let (domain, mask, tier, census_unknown) = match spec {
                Some(s) => (s.domain.as_str(), s.mask, s.tier.as_str(), false),
                None => {
                    tracing::error!(
                        record = %record.act_id,
                        family = record.family.as_str(),
                        role = leg.role.as_str(),
                        "no census leg spec; ingesting with minimal fallback metadata"
                    );
                    ("minimal", [false, false, false, true], "marginal", true)
                }
            };
            sqlx::query!(
                "INSERT INTO mirror_record_legs
                     (record_id, leg, source, target, p_d, p_i,
                      domain, mask_a00, mask_a01, mask_a10, mask_a11, tier,
                      tau, family, epoch, act_time, position, census_unknown)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)",
                record.act_id.to_string(),
                leg.role.as_str(),
                leg.source.to_string(),
                leg.target.to_string(),
                leg.p_d,
                leg.p_i,
                domain,
                mask[0],
                mask[1],
                mask[2],
                mask[3],
                tier,
                leg.tau,
                record.family.as_str(),
                record.epoch,
                record.act_time,
                record.position,
                census_unknown,
            )
            .execute(&mut *tx)
            .await?;
        }
    }
    sqlx::query!(
        "UPDATE mirror_epoch_cursor SET last_epoch = $1 WHERE singleton",
        package.epoch,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// Whether any accepted record of the family by the author is in the
/// mirror (the genesis gate reads this — architecture.md
/// "Genesis bootstrap").
pub async fn has_record_by(
    pool: &PgPool,
    author: &str,
    family: Family,
) -> Result<bool, MirrorError> {
    Ok(sqlx::query_scalar!(
        r#"SELECT EXISTS(
               SELECT 1 FROM mirror_records WHERE author = $1 AND family = $2
           ) AS "exists!""#,
        author,
        family.as_str(),
    )
    .fetch_one(pool)
    .await?)
}

/// Record identifiers in one epoch, in authoritative order (tests and the
/// dev CLI read this).
pub async fn record_ids_in_epoch(pool: &PgPool, epoch: i64) -> Result<Vec<String>, MirrorError> {
    Ok(sqlx::query_scalar!(
        "SELECT record_id FROM mirror_records WHERE epoch = $1 ORDER BY position",
        epoch,
    )
    .fetch_all(pool)
    .await?)
}

/// One mirror record's identity and causal key (the slice-1 read
/// surface; the full record read arrives with the content slice).
#[derive(Debug, Clone)]
pub struct RecordMeta {
    pub record_id: String,
    pub family: String,
    pub epoch: i64,
    pub act_time: i64,
    pub position: i64,
}

pub async fn record_meta(
    pool: &PgPool,
    record_id: &str,
) -> Result<Option<RecordMeta>, MirrorError> {
    Ok(sqlx::query!(
        "SELECT record_id, family, epoch, act_time, position
         FROM mirror_records WHERE record_id = $1",
        record_id,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| RecordMeta {
        record_id: r.record_id,
        family: r.family,
        epoch: r.epoch,
        act_time: r.act_time,
        position: r.position,
    }))
}

/// One accepted record as the public chronicle serves it (api-spec "The
/// record"): the mirror row plus its legs.
#[derive(Debug, Clone)]
pub struct RecordFull {
    pub record_id: String,
    pub family: String,
    pub author: String,
    pub epoch: i64,
    pub act_time: i64,
    pub position: i64,
    pub payload_marked: bool,
    pub payload_witness: Vec<u8>,
    pub legs: Vec<RecordLeg>,
}

#[derive(Debug, Clone)]
pub struct RecordLeg {
    pub leg: String,
    pub source: String,
    pub target: String,
    pub p_d: f64,
    pub p_i: f64,
    /// True when ingestion had no census spec for this leg's role and
    /// wrote fallback domain, mask and tier. The parameters are the
    /// record's own; the family-fixed metadata beside them is invented.
    pub census_unknown: bool,
}

impl RecordFull {
    /// The far end of a binary act, or the middle node the A leg enters
    /// on a hyper act (api-spec `Record.target`).
    pub fn target(&self) -> Option<&RecordLeg> {
        self.legs.iter().find(|l| l.leg == "binary" || l.leg == "a")
    }

    /// The terminal leg's node — hyper acts only.
    pub fn terminal(&self) -> Option<&RecordLeg> {
        self.legs.iter().find(|l| l.leg == "t")
    }
}

/// Filters for the `records` chronicle query — each is conjunctive;
/// None means unfiltered. `target` matches the binary/A leg (the
/// record's target in the api-spec sense); `terminal` matches the T leg.
#[derive(Debug, Clone, Default)]
pub struct RecordFilter {
    pub author: Option<String>,
    pub target: Option<String>,
    pub terminal: Option<String>,
    pub family: Option<String>,
    pub payload_marked: Option<bool>,
    pub since_epoch: Option<i64>,
    pub until_epoch: Option<i64>,
}

/// One record by its identifier, with legs; None when the mirror does
/// not hold it.
pub async fn record_full(
    pool: &PgPool,
    record_id: &str,
) -> Result<Option<RecordFull>, MirrorError> {
    let Some(row) = sqlx::query!(
        "SELECT record_id, family, author, epoch, act_time, position,
                payload_marked, payload_witness
         FROM mirror_records WHERE record_id = $1",
        record_id,
    )
    .fetch_optional(pool)
    .await?
    else {
        return Ok(None);
    };
    let legs = legs_for(pool, std::slice::from_ref(&row.record_id))
        .await?
        .into_iter()
        .map(|l| l.leg)
        .collect();
    Ok(Some(RecordFull {
        record_id: row.record_id,
        family: row.family,
        author: row.author,
        epoch: row.epoch,
        act_time: row.act_time,
        position: row.position,
        payload_marked: row.payload_marked,
        payload_witness: row.payload_witness,
        legs,
    }))
}

/// One mirror row as the chronicle read selects it, before its legs are
/// attached. Named rather than anonymous because the two direction
/// branches must agree on one row type.
struct RecordRow {
    record_id: String,
    family: String,
    author: String,
    epoch: i64,
    act_time: i64,
    position: i64,
    payload_marked: bool,
    payload_witness: Vec<u8>,
}

/// The chronicle read (api-spec `records`): filterable along the
/// mirror's own indexes, newest-first in landing order — keyset cursor
/// on the authoritative causal key `(epoch, act_time, position)`.
/// `backward` serves `last`/`before`; results always come back
/// newest-first.
pub async fn records(
    pool: &PgPool,
    filter: &RecordFilter,
    cursor: Option<(i64, i64, i64)>,
    backward: bool,
    limit: i64,
) -> Result<Vec<RecordFull>, MirrorError> {
    let (ce, ca, cp) = match cursor {
        Some((e, a, p)) => (Some(e), Some(a), Some(p)),
        None => (None, None, None),
    };
    let rows = if backward {
        sqlx::query_as!(
            RecordRow,
            r#"SELECT * FROM (
                   SELECT r.record_id, r.family, r.author, r.epoch, r.act_time,
                          r.position, r.payload_marked, r.payload_witness
                   FROM mirror_records r
                   WHERE ($1::text IS NULL OR r.author = $1)
                     AND ($2::text IS NULL OR r.family = $2)
                     AND ($3::boolean IS NULL OR r.payload_marked = $3)
                     AND ($4::bigint IS NULL OR r.epoch >= $4)
                     AND ($5::bigint IS NULL OR r.epoch <= $5)
                     AND ($6::text IS NULL OR EXISTS (
                             SELECT 1 FROM mirror_record_legs l
                             WHERE l.record_id = r.record_id
                               AND l.leg IN ('binary', 'a') AND l.target = $6))
                     AND ($7::text IS NULL OR EXISTS (
                             SELECT 1 FROM mirror_record_legs l
                             WHERE l.record_id = r.record_id
                               AND l.leg = 't' AND l.target = $7))
                     AND ($8::bigint IS NULL
                          OR (r.epoch, r.act_time, r.position) > ($8, $9, $10))
                   ORDER BY r.epoch ASC, r.act_time ASC, r.position ASC
                   LIMIT $11
               ) page
               ORDER BY epoch DESC, act_time DESC, position DESC"#,
            filter.author.as_deref(),
            filter.family.as_deref(),
            filter.payload_marked,
            filter.since_epoch,
            filter.until_epoch,
            filter.target.as_deref(),
            filter.terminal.as_deref(),
            ce,
            ca,
            cp,
            limit,
        )
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as!(
            RecordRow,
            r#"SELECT r.record_id, r.family, r.author, r.epoch, r.act_time,
                      r.position, r.payload_marked, r.payload_witness
               FROM mirror_records r
               WHERE ($1::text IS NULL OR r.author = $1)
                 AND ($2::text IS NULL OR r.family = $2)
                 AND ($3::boolean IS NULL OR r.payload_marked = $3)
                 AND ($4::bigint IS NULL OR r.epoch >= $4)
                 AND ($5::bigint IS NULL OR r.epoch <= $5)
                 AND ($6::text IS NULL OR EXISTS (
                         SELECT 1 FROM mirror_record_legs l
                         WHERE l.record_id = r.record_id
                           AND l.leg IN ('binary', 'a') AND l.target = $6))
                 AND ($7::text IS NULL OR EXISTS (
                         SELECT 1 FROM mirror_record_legs l
                         WHERE l.record_id = r.record_id
                           AND l.leg = 't' AND l.target = $7))
                 AND ($8::bigint IS NULL
                      OR (r.epoch, r.act_time, r.position) < ($8, $9, $10))
               ORDER BY r.epoch DESC, r.act_time DESC, r.position DESC
               LIMIT $11"#,
            filter.author.as_deref(),
            filter.family.as_deref(),
            filter.payload_marked,
            filter.since_epoch,
            filter.until_epoch,
            filter.target.as_deref(),
            filter.terminal.as_deref(),
            ce,
            ca,
            cp,
            limit,
        )
        .fetch_all(pool)
        .await?
    };
    let ids: Vec<String> = rows.iter().map(|r| r.record_id.clone()).collect();
    let mut legs = legs_for(pool, &ids).await?;
    Ok(rows
        .into_iter()
        .map(|r| RecordFull {
            legs: {
                let mut own: Vec<RecordLeg> = Vec::new();
                legs.retain(|l| {
                    if l.record_id == r.record_id {
                        own.push(l.leg.clone());
                        false
                    } else {
                        true
                    }
                });
                own
            },
            record_id: r.record_id,
            family: r.family,
            author: r.author,
            epoch: r.epoch,
            act_time: r.act_time,
            position: r.position,
            payload_marked: r.payload_marked,
            payload_witness: r.payload_witness,
        })
        .collect())
}

struct LegOwned {
    record_id: String,
    leg: RecordLeg,
}

async fn legs_for(pool: &PgPool, record_ids: &[String]) -> Result<Vec<LegOwned>, MirrorError> {
    if record_ids.is_empty() {
        return Ok(vec![]);
    }
    Ok(sqlx::query!(
        "SELECT record_id, leg, source, target, p_d, p_i, census_unknown
         FROM mirror_record_legs WHERE record_id = ANY($1)",
        record_ids,
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|l| LegOwned {
        record_id: l.record_id,
        leg: RecordLeg {
            leg: l.leg,
            source: l.source,
            target: l.target,
            p_d: l.p_d,
            p_i: l.p_i,
            census_unknown: l.census_unknown,
        },
    })
    .collect())
}

/// The newest accepted record of one family by one author toward one
/// node, by causal order — the edit-chain head (post.md §4). CoGra's
/// API is the only author path and serializes edits per (node, author)
/// while always asserting the previous head, so no branch can be
/// authored through it and newest-by-causal-key IS the chain head; a
/// chain walk over asserted parents adds nothing until foreign authors
/// exist (the client-direct transport workstream).
pub async fn chain_head(
    pool: &PgPool,
    author: &str,
    family: Family,
    node: &str,
) -> Result<Option<String>, MirrorError> {
    Ok(sqlx::query_scalar!(
        "SELECT r.record_id
         FROM mirror_records r
         JOIN mirror_record_legs l ON l.record_id = r.record_id
         WHERE r.author = $1 AND r.family = $2
           AND l.leg IN ('binary', 't') AND l.target = $3
         ORDER BY r.epoch DESC, r.act_time DESC, r.position DESC
         LIMIT 1",
        author,
        family.as_str(),
        node,
    )
    .fetch_optional(pool)
    .await?)
}

/// The epoch in which the record that minted this node landed, or None
/// while it has not landed.
///
/// The minting record is the earliest one whose own leg *targets* the
/// node — a genesis act's target is the node's identifier. Ordering by
/// the causal key and taking the first is what makes "earliest" the
/// substrate's answer rather than an insertion-order accident.
///
/// This is the landing fact for nodes CoGra does not carry a
/// landing-order column for. Content nodes do carry one, promoted onto
/// their display rows, and read it from there instead of paying for this.
pub async fn minting_epoch(
    pool: &PgPool,
    family: Family,
    node: &str,
) -> Result<Option<i64>, MirrorError> {
    Ok(sqlx::query_scalar!(
        "SELECT r.epoch
         FROM mirror_records r
         JOIN mirror_record_legs l ON l.record_id = r.record_id
         WHERE r.family = $1 AND l.leg IN ('binary', 't') AND l.target = $2
         ORDER BY r.epoch ASC, r.act_time ASC, r.position ASC
         LIMIT 1",
        family.as_str(),
        node,
    )
    .fetch_optional(pool)
    .await?)
}

/// Whether any accepted Opinion by the author toward the node is in the
/// mirror — existence, not net: a bundle netting to zero still holds the
/// gesture (auth.md "Reciprocation is the joiner's own act").
pub async fn has_opinion_toward(
    pool: &PgPool,
    author_source: &str,
    target: &str,
) -> Result<bool, MirrorError> {
    Ok(sqlx::query_scalar!(
        r#"SELECT EXISTS(
               SELECT 1 FROM mirror_record_legs
               WHERE family = 'opinion' AND leg = 'binary'
                 AND source = $1 AND target = $2
           ) AS "exists!""#,
        author_source,
        target,
    )
    .fetch_one(pool)
    .await?)
}

/// Wipes the mirror and resets the cursor; used by the dev CLI's rebuild
/// command and tests (re-ingest from the published sequence).
pub async fn reset(pool: &PgPool) -> Result<(), MirrorError> {
    let mut tx = pool.begin().await?;
    sqlx::query!("DELETE FROM mirror_record_legs")
        .execute(&mut *tx)
        .await?;
    sqlx::query!("DELETE FROM mirror_records")
        .execute(&mut *tx)
        .await?;
    sqlx::query!("UPDATE mirror_epoch_cursor SET last_epoch = -1 WHERE singleton")
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(())
}
