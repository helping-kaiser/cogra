// The record mirror (data-model.md "The record mirror"): appends published
// epoch packages and advances the epoch cursor in one transaction
// (architecture.md "Record ingestion"). The mirror may lag L1, must never
// diverge, and is fully rebuildable from the published ordered sequence —
// nothing here is authoritative and no row is ever precious.

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
            // Domain, mask, and tier are family-fixed (common::l1::census).
            let spec = record
                .family
                .legs()
                .iter()
                .find(|s| s.role == leg.role)
                .copied();
            let (domain, mask, tier) = match spec {
                Some(s) => (s.domain.as_str(), s.mask, s.tier.as_str()),
                // Unreachable for census-valid packages; keep the append
                // total rather than dropping a published record — but a
                // fabricated census row is exactly the divergence the
                // mirror contract forbids leaving unmarked.
                None => {
                    tracing::error!(
                        record = %record.act_id,
                        family = record.family.as_str(),
                        role = leg.role.as_str(),
                        "no census leg spec; ingesting with minimal fallback metadata"
                    );
                    ("minimal", [false, false, false, true], "marginal")
                }
            };
            sqlx::query!(
                "INSERT INTO mirror_record_legs
                     (record_id, leg, source, target, p_d, p_i,
                      domain, mask_a00, mask_a01, mask_a10, mask_a11, tier,
                      tau, family, epoch, act_time, position)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)",
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

/// The net of one author's Opinion bundle toward one node — the sum of
/// the authored parameters across their accepted Opinion records
/// (api-spec "The generic stance": the client states intent as the net;
/// the backend derives the delta record from this read).
pub async fn net_opinion(
    pool: &PgPool,
    author_source: &str,
    target: &str,
) -> Result<(f64, f64), MirrorError> {
    let row = sqlx::query!(
        r#"SELECT COALESCE(SUM(p_d), 0)::float8 AS "p_d!",
                  COALESCE(SUM(p_i), 0)::float8 AS "p_i!"
           FROM mirror_record_legs
           WHERE family = 'opinion' AND leg = 'binary'
             AND source = $1 AND target = $2"#,
        author_source,
        target,
    )
    .fetch_one(pool)
    .await?;
    Ok((row.p_d, row.p_i))
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

/// Wipes the mirror and resets the cursor. The mirror is a rebuildable
/// projection — this is the documented recovery path (re-ingest from the
/// published sequence), used by the dev CLI's rebuild command and tests.
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
