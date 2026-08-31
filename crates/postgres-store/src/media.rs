//! ´mod:module:media´
//!
//! Media asset rows — the SQL half of the api crate's media module.
//!
//! An asset row is a pure asset: metadata about bytes, with no pointer to
//! any parent. Parents point at assets and assets never point back, so
//! the natural query is always parent to attachments (data-model.md "Why
//! parents point at attachments").
//!
//! The row is immutable after upload. There is no update surface and
//! there never will be: alt text rides the payload envelope, so editing
//! it is a new record either way, and an asset that cannot change needs
//! no version rows.
//!
//! `author_id` here is Postgres-native truth rather than a cached
//! derivation — media is not a graph node, so there is no graph-side
//! authorship to cache from.

use chrono::{DateTime, Utc};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

/// One asset row.
#[derive(Debug, Clone)]
pub struct MediaAttachment {
    pub id: Uuid,
    pub author_id: Uuid,
    pub digest: Vec<u8>,
    pub digest_algo: String,
    pub storage_key: String,
    pub mime_type: String,
    pub size_bytes: Option<i64>,
    pub alt_text: Option<String>,
    pub options: serde_json::Value,
    pub redaction_reason: Option<String>,
    pub redacted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// What a sweep removed: the id for the log, the key for the store.
#[derive(Debug, Clone)]
pub struct SweptAsset {
    pub id: Uuid,
    pub storage_key: String,
}

/// Records an uploaded asset, or returns the one this author already has
/// for these bytes.
///
/// The conflict arm is a no-op update rather than `DO NOTHING` so the
/// statement returns a row either way — `DO NOTHING` suppresses
/// `RETURNING`, which would turn a retried upload into a second round
/// trip and a race. The caller tells the two cases apart by comparing the
/// returned `storage_key` against the one it generated: a different key
/// means the row was already there and the object just written is an
/// orphan to collect.
///
/// Uniqueness is on `(author_id, digest)`, never on the digest alone: two
/// authors uploading identical bytes get two rows and two objects, so
/// removing one author's asset can never break the other's render.
#[allow(clippy::too_many_arguments)]
pub async fn insert(
    pool: &PgPool,
    id: Uuid,
    author_id: Uuid,
    digest: &[u8],
    digest_algo: &str,
    storage_key: &str,
    mime_type: &str,
    size_bytes: i64,
    alt_text: Option<&str>,
    options: &serde_json::Value,
) -> Result<MediaAttachment, sqlx::Error> {
    sqlx::query_as!(
        MediaAttachment,
        r#"
        INSERT INTO media_attachments
            (id, author_id, digest, digest_algo, storage_key,
             mime_type, size_bytes, alt_text, options)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (author_id, digest)
            DO UPDATE SET author_id = media_attachments.author_id
        RETURNING id, author_id, digest, digest_algo, storage_key,
                  mime_type, size_bytes, alt_text,
                  options AS "options!: serde_json::Value",
                  redaction_reason, redacted_at, created_at
        "#,
        id,
        author_id,
        digest,
        digest_algo,
        storage_key,
        mime_type,
        size_bytes,
        alt_text,
        options,
    )
    .fetch_one(pool)
    .await
}

/// One entry of a version's gallery: the asset and the facts that are
/// about *this* placement of it rather than about the bytes.
#[derive(Debug, Clone)]
pub struct GalleryEntry {
    pub asset: MediaAttachment,
    pub display_order: i16,
    /// Which asset leads a multi-asset post. Always false on a comment
    /// gallery, which has no cover column and no lead asset.
    pub is_cover: bool,
}

/// Writes one version's gallery, in order.
///
/// Position is the order: `display_order` is the index and the cover is
/// index 0, the same convention the payload envelope's manifest carries
/// (`common::envelope::MediaAsset`, whose array position is the gallery
/// order). Storing a second, independent index would let Postgres and the
/// witnessed record disagree about what a reader sees.
///
/// Idempotent on re-running the write that produced it: a retried
/// pre-sign re-inserts the same rows onto the same version.
pub async fn attach_to_post_version(
    tx: &mut Transaction<'_, Postgres>,
    post_version_id: i64,
    attachment_ids: &[Uuid],
) -> Result<(), sqlx::Error> {
    if attachment_ids.is_empty() {
        return Ok(());
    }
    let orders: Vec<i16> = (0..attachment_ids.len() as i16).collect();
    sqlx::query!(
        "INSERT INTO post_attachments
             (post_version_id, attachment_id, display_order, is_cover)
         SELECT $1, a.id, a.ord, a.ord = 0
         FROM unnest($2::uuid[], $3::smallint[]) AS a(id, ord)
         ON CONFLICT (post_version_id, attachment_id) DO NOTHING",
        post_version_id,
        attachment_ids,
        &orders,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The comment side of [`attach_to_post_version`]. No cover: a comment
/// gallery is a supporting picture set, and `isCover` applies to post
/// galleries only (api-spec.md "Content authoring").
pub async fn attach_to_comment_version(
    tx: &mut Transaction<'_, Postgres>,
    comment_version_id: i64,
    attachment_ids: &[Uuid],
) -> Result<(), sqlx::Error> {
    if attachment_ids.is_empty() {
        return Ok(());
    }
    let orders: Vec<i16> = (0..attachment_ids.len() as i16).collect();
    sqlx::query!(
        "INSERT INTO comment_attachments
             (comment_version_id, attachment_id, display_order)
         SELECT $1, a.id, a.ord
         FROM unnest($2::uuid[], $3::smallint[]) AS a(id, ord)
         ON CONFLICT (comment_version_id, attachment_id) DO NOTHING",
        comment_version_id,
        attachment_ids,
        &orders,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

struct GalleryRow {
    version_id: i64,
    display_order: i16,
    is_cover: bool,
    id: Uuid,
    author_id: Uuid,
    digest: Vec<u8>,
    digest_algo: String,
    storage_key: String,
    mime_type: String,
    size_bytes: Option<i64>,
    alt_text: Option<String>,
    options: serde_json::Value,
    redaction_reason: Option<String>,
    redacted_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
}

fn gallery_entry(row: GalleryRow) -> (i64, GalleryEntry) {
    (
        row.version_id,
        GalleryEntry {
            asset: MediaAttachment {
                id: row.id,
                author_id: row.author_id,
                digest: row.digest,
                digest_algo: row.digest_algo,
                storage_key: row.storage_key,
                mime_type: row.mime_type,
                size_bytes: row.size_bytes,
                alt_text: row.alt_text,
                options: row.options,
                redaction_reason: row.redaction_reason,
                redacted_at: row.redacted_at,
                created_at: row.created_at,
            },
            display_order: row.display_order,
            is_cover: row.is_cover,
        },
    )
}

/// The galleries of many post versions at once, each in gallery order —
/// the batched read a dataloader serves a whole page of posts from.
///
/// Keyed on the version rather than the post because that is what the
/// gallery belongs to: a node's current gallery is the current version's
/// rows, and a superseded version keeps its own.
pub async fn post_galleries(
    pool: &PgPool,
    version_ids: &[i64],
) -> Result<Vec<(i64, GalleryEntry)>, sqlx::Error> {
    let rows = sqlx::query_as!(
        GalleryRow,
        r#"SELECT j.post_version_id AS "version_id!", j.display_order,
                  j.is_cover,
                  m.id, m.author_id, m.digest, m.digest_algo, m.storage_key,
                  m.mime_type, m.size_bytes, m.alt_text,
                  m.options AS "options!: serde_json::Value",
                  m.redaction_reason, m.redacted_at, m.created_at
           FROM post_attachments j
           JOIN media_attachments m ON m.id = j.attachment_id
           WHERE j.post_version_id = ANY($1)
           ORDER BY j.post_version_id, j.display_order, m.id"#,
        version_ids,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(gallery_entry).collect())
}

/// The comment side of [`post_galleries`]; `is_cover` reads false
/// throughout, the column not existing on this junction.
pub async fn comment_galleries(
    pool: &PgPool,
    version_ids: &[i64],
) -> Result<Vec<(i64, GalleryEntry)>, sqlx::Error> {
    let rows = sqlx::query_as!(
        GalleryRow,
        r#"SELECT j.comment_version_id AS "version_id!", j.display_order,
                  FALSE AS "is_cover!",
                  m.id, m.author_id, m.digest, m.digest_algo, m.storage_key,
                  m.mime_type, m.size_bytes, m.alt_text,
                  m.options AS "options!: serde_json::Value",
                  m.redaction_reason, m.redacted_at, m.created_at
           FROM comment_attachments j
           JOIN media_attachments m ON m.id = j.attachment_id
           WHERE j.comment_version_id = ANY($1)
           ORDER BY j.comment_version_id, j.display_order, m.id"#,
        version_ids,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(gallery_entry).collect())
}

/// The author's assets for a set of digests — how a landed payload's
/// manifest is turned back into rows.
///
/// `(author_id, digest)` is unique, so an author and a digest name at most
/// one asset and the manifest resolves without ambiguity. Scoping to the
/// author is not an optimisation: two authors may hold identical bytes
/// under two rows, and a manifest names its own author's assets only
/// (data-model.md "Why parents point at attachments" — the anti-hijack
/// rule).
pub async fn assets_by_digests(
    pool: &PgPool,
    author_id: Uuid,
    digests: &[Vec<u8>],
) -> Result<Vec<MediaAttachment>, sqlx::Error> {
    sqlx::query_as!(
        MediaAttachment,
        r#"
        SELECT id, author_id, digest, digest_algo, storage_key,
               mime_type, size_bytes, alt_text,
               options AS "options!: serde_json::Value",
               redaction_reason, redacted_at, created_at
        FROM media_attachments
        WHERE author_id = $1 AND digest = ANY($2)
        "#,
        author_id,
        digests,
    )
    .fetch_all(pool)
    .await
}

/// Many assets by id, in one round trip — what a gallery input is
/// resolved through before anything is staged.
pub async fn assets_by_ids(
    pool: &PgPool,
    ids: &[Uuid],
) -> Result<Vec<MediaAttachment>, sqlx::Error> {
    sqlx::query_as!(
        MediaAttachment,
        r#"
        SELECT id, author_id, digest, digest_algo, storage_key,
               mime_type, size_bytes, alt_text,
               options AS "options!: serde_json::Value",
               redaction_reason, redacted_at, created_at
        FROM media_attachments
        WHERE id = ANY($1)
        "#,
        ids,
    )
    .fetch_all(pool)
    .await
}

/// One asset by id.
pub async fn by_id(pool: &PgPool, id: Uuid) -> Result<Option<MediaAttachment>, sqlx::Error> {
    sqlx::query_as!(
        MediaAttachment,
        r#"
        SELECT id, author_id, digest, digest_algo, storage_key,
               mime_type, size_bytes, alt_text,
               options AS "options!: serde_json::Value",
               redaction_reason, redacted_at, created_at
        FROM media_attachments
        WHERE id = $1
        "#,
        id,
    )
    .fetch_optional(pool)
    .await
}

/// Collects assets nobody kept.
///
/// An upload precedes the write that references it, so a compose the
/// author abandoned leaves a row and an object that no parent will ever
/// point at. Nothing else collects them: staged writes have their own
/// epoch-denominated GC, and an asset is not a staged write.
///
/// **The join is the seam.** "Orphaned" means no reference from any of
/// the four content junctions and none from the two profile columns and
/// the chat image column. Every one of those references is checked here,
/// in one query, deliberately: a reference this list misses is an asset
/// deleted out from under a live parent, so the list must be extended in
/// the same change that adds a way to reference an asset.
///
/// Two consequences of the junctions being keyed on the version row
/// rather than the entity, both of which this query gets right by
/// existing rather than by testing anything:
///
/// - A **pending** write's version row and its junction rows are written
///   at the pre-commitment, so an asset on an unlanded post or edit is
///   already referenced and is *not* an orphan. Age alone would delete it.
/// - A **superseded** version keeps its own junction rows, so an asset an
///   edit removed from the gallery is still referenced by the version that
///   carried it. That is the correct answer rather than an accident: the
///   old bytes' digests stay committed on the superseded record (post.md
///   §4), so the bytes have to stay too.
///
/// Each `NOT EXISTS` is an index-only probe of the junction's reverse
/// index on `attachment_id`; without it Postgres has no index leading with
/// that column and every probe is a sequential scan.
///
/// Rows are deleted and their keys returned; the caller removes the
/// objects. Doing it in that order means a crash between the two leaves
/// an unreferenced object rather than a row pointing at nothing.
pub async fn sweep_orphans(
    pool: &PgPool,
    max_age_secs: f64,
) -> Result<Vec<SweptAsset>, sqlx::Error> {
    sqlx::query_as!(
        SweptAsset,
        r#"
        DELETE FROM media_attachments m
        WHERE m.created_at <= now() - make_interval(secs => $1)
          AND NOT EXISTS (SELECT 1 FROM post_attachments         a WHERE a.attachment_id = m.id)
          AND NOT EXISTS (SELECT 1 FROM comment_attachments      a WHERE a.attachment_id = m.id)
          AND NOT EXISTS (SELECT 1 FROM chat_message_attachments a WHERE a.attachment_id = m.id)
          AND NOT EXISTS (SELECT 1 FROM item_attachments         a WHERE a.attachment_id = m.id)
          AND NOT EXISTS (
                SELECT 1 FROM actor_profile_versions p WHERE p.avatar_id = m.id)
          AND NOT EXISTS (SELECT 1 FROM chat_versions c WHERE c.image_id = m.id)
        RETURNING id, storage_key
        "#,
        max_age_secs,
    )
    .fetch_all(pool)
    .await
}
