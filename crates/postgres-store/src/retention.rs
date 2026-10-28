//! ´mod:module:retention´
//!
//! The retention archive (retention-archive.md; data-model.md "The
//! retention archive"): the one store a redacted act's content outlives
//! its carriage in, and the reference rule that decides when a shared
//! media asset follows it.
//!
//! An archive row is one *unit*: for a graph-side redaction, the act's
//! envelope, content salt, proposal nonce, witness and media list, held
//! together and hard-deleted together. The unit's shape is the caller's
//! (`original_data` is schema-on-read); this module stores it, records the
//! media it references, and answers the two questions those references
//! exist for — is an asset still placed anywhere live, and does any other
//! held unit still name it.

use sqlx::PgConnection;
use uuid::Uuid;

use crate::media::MediaArea;

/// The archive's `original_type` for a graph-side redaction of one act.
pub const ACT_PAYLOAD: &str = "act_payload";

/// A unit about to be archived.
#[derive(Debug, Clone)]
pub struct NewUnit<'a> {
    pub original_id: &'a str,
    pub original_type: &'a str,
    pub original_data: serde_json::Value,
    pub redaction_reason: &'a str,
    pub redacted_by: &'a str,
    /// The media assets the unit references, by asset id.
    pub media: &'a [Uuid],
}

/// Writes one unit and its media references, returning the row id — or
/// None when the same redaction already archived it (the row is keyed on
/// what was redacted and by whom, so a retried redaction writes once).
/// Runs on the redaction's own connection, so the unit commits with the
/// reduction it records or not at all.
///
/// `legal_hold_until` is left NULL: the MVP holds every unit until a
/// manual operator act, and no job deletes one.
pub async fn insert_unit(
    conn: &mut PgConnection,
    unit: &NewUnit<'_>,
) -> Result<Option<Uuid>, sqlx::Error> {
    let id = sqlx::query_scalar!(
        "INSERT INTO retention_archive
             (original_id, original_type, original_data, redaction_reason, redacted_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (original_id, original_type, redacted_by) DO NOTHING
         RETURNING id",
        unit.original_id,
        unit.original_type,
        unit.original_data,
        unit.redaction_reason,
        unit.redacted_by,
    )
    .fetch_optional(&mut *conn)
    .await?;
    if let Some(id) = id {
        sqlx::query!(
            "INSERT INTO retention_archive_media (archive_id, media_id)
             SELECT $1, m FROM UNNEST($2::UUID[]) AS m
             ON CONFLICT DO NOTHING",
            id,
            unit.media,
        )
        .execute(&mut *conn)
        .await?;
    }
    Ok(id)
}

/// Whether any unit already archives `original_id` as `original_type`,
/// whoever redacted it.
pub async fn is_archived(
    conn: &mut PgConnection,
    original_id: &str,
    original_type: &str,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT EXISTS(
               SELECT 1 FROM retention_archive
               WHERE original_id = $1 AND original_type = $2
           ) AS "exists!""#,
        original_id,
        original_type,
    )
    .fetch_one(conn)
    .await
}

/// One archived unit as stored.
#[derive(Debug, Clone)]
pub struct Unit {
    pub id: Uuid,
    pub original_id: String,
    pub original_type: String,
    pub original_data: serde_json::Value,
    pub redaction_reason: String,
    pub redacted_by: String,
    pub redacted_at: chrono::DateTime<chrono::Utc>,
    pub legal_hold_until: Option<chrono::DateTime<chrono::Utc>>,
    pub media: Vec<Uuid>,
}

/// Every unit archiving `original_id`, oldest first — the operator's read.
pub async fn units_of(
    conn: &mut PgConnection,
    original_id: &str,
) -> Result<Vec<Unit>, sqlx::Error> {
    Ok(sqlx::query!(
        r#"SELECT a.id, a.original_id, a.original_type, a.original_data,
                  a.redaction_reason, a.redacted_by, a.redacted_at, a.legal_hold_until,
                  COALESCE(ARRAY_AGG(r.media_id ORDER BY r.media_id)
                           FILTER (WHERE r.media_id IS NOT NULL), '{}') AS "media!"
           FROM retention_archive a
           LEFT JOIN retention_archive_media r ON r.archive_id = a.id
           WHERE a.original_id = $1
           GROUP BY a.id
           ORDER BY a.redacted_at, a.id"#,
        original_id,
    )
    .fetch_all(conn)
    .await?
    .into_iter()
    .map(|r| Unit {
        id: r.id,
        original_id: r.original_id,
        original_type: r.original_type,
        original_data: r.original_data,
        redaction_reason: r.redaction_reason,
        redacted_by: r.redacted_by,
        redacted_at: r.redacted_at,
        legal_hold_until: r.legal_hold_until,
        media: r.media,
    })
    .collect())
}

/// Moves under hold every asset of `media` that no live placement shows
/// any more, returning the ones this call moved.
///
/// An asset is referenced, never copied, and one asset can sit in several
/// placements — versions of one post, several posts, the avatar slot — so
/// the redaction of one placement must leave it serving the others. It
/// belongs to the archive only once its **last** live placement is gone.
///
/// What counts as a live placement is the migration's
/// `media_live_placed`, the one statement of the rule: the orphan sweep's
/// placement set, where a post, comment or profile version stops counting
/// once it is tombstoned or its act's carriage is reduced.
///
/// Call it inside the redaction's transaction after the reduction, so the
/// acts this redaction reduced already read as gone. Calling it again
/// later — after the display tombstones are written — settles any asset a
/// display row was still showing.
///
/// This marks the hold; the bytes follow after the transaction commits,
/// into the operator-only area (`media_attachments.area`), once the move
/// re-checks that no live placement shows the asset by then.
///
/// **A held asset frees its digest.** `(author, digest)` names at most one
/// *live* asset, so an upload of the same file afterwards mints a fresh
/// one rather than resolving to bytes that left the live store. The rows
/// merged into a held asset are pointers to it and carry the digest their
/// upload arrived with, so they are marked with it — or a re-upload of
/// that original would still resolve, through the pointer, to the archive.
pub async fn hold_unplaced(
    conn: &mut PgConnection,
    media: &[Uuid],
) -> Result<Vec<Uuid>, sqlx::Error> {
    let held = sqlx::query_scalar!(
        r#"UPDATE media_attachments
           SET held_at = NOW()
           WHERE id = ANY($1) AND held_at IS NULL AND NOT media_live_placed(id)
           RETURNING id"#,
        media,
    )
    .fetch_all(&mut *conn)
    .await?;
    if !held.is_empty() {
        sqlx::query!(
            "UPDATE media_attachments
             SET held_at = NOW()
             WHERE merged_into = ANY($1) AND held_at IS NULL",
            &held,
        )
        .execute(&mut *conn)
        .await?;
    }
    Ok(held)
}

/// Whether a live placement still shows the asset (`media_live_placed`).
pub async fn is_live_placed(conn: &mut PgConnection, media_id: Uuid) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar!(r#"SELECT media_live_placed($1) AS "placed!""#, media_id)
        .fetch_one(conn)
        .await
}

/// An object a hard delete leaves with no reference: its asset row and
/// the key its bytes sit under, and the area that holds them — the
/// operator store once the hold's move has run, the live store before.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LastReference {
    pub media_id: Uuid,
    pub storage_key: String,
    pub area: MediaArea,
}

/// What a manual hard delete of one unit removed.
#[derive(Debug, Clone)]
pub struct HardDeleted {
    pub original_id: String,
    pub original_type: String,
    /// The objects no other held unit and no live placement references,
    /// whose bytes the operator act deletes from the media store.
    pub last_references: Vec<LastReference>,
}

/// The archive's half of a manual hard delete (PR-58: the MVP runs no
/// job): deletes the unit row and its media references, and names the
/// objects that were referenced by this unit alone — no other held unit
/// names them and no live placement shows them — so the operator act
/// removes exactly those bytes with it and nothing another unit still
/// holds. An object still named elsewhere stays, whichever unit is
/// deleted first. Returns None for an id that holds no unit.
///
/// Runs on the caller's connection; the operator command composes it with
/// its own log line in one transaction and deletes the named objects once
/// that commits.
pub async fn hard_delete_unit(
    conn: &mut PgConnection,
    archive_id: Uuid,
) -> Result<Option<HardDeleted>, sqlx::Error> {
    let Some(unit) = sqlx::query!(
        r#"SELECT original_id, original_type,
                  COALESCE(ARRAY(SELECT media_id FROM retention_archive_media
                                 WHERE archive_id = $1), '{}') AS "media!"
           FROM retention_archive WHERE id = $1
           FOR UPDATE"#,
        archive_id,
    )
    .fetch_optional(&mut *conn)
    .await?
    else {
        return Ok(None);
    };
    sqlx::query!("DELETE FROM retention_archive WHERE id = $1", archive_id)
        .execute(&mut *conn)
        .await?;
    let last_references = sqlx::query_as!(
        LastReference,
        r#"SELECT m.id AS media_id, m.storage_key, m.area AS "area: MediaArea"
           FROM media_attachments m
           WHERE m.id = ANY($1)
             AND NOT EXISTS (SELECT 1 FROM retention_archive_media r WHERE r.media_id = m.id)
             AND NOT media_live_placed(m.id)
           ORDER BY m.id"#,
        &unit.media,
    )
    .fetch_all(&mut *conn)
    .await?;
    Ok(Some(HardDeleted {
        original_id: unit.original_id,
        original_type: unit.original_type,
        last_references,
    }))
}
