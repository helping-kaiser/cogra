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
use sqlx::PgPool;
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
/// the same change that adds a way to reference an asset. In particular a
/// pending post's junction rows already exist, so an asset attached to an
/// unlanded write is *not* orphaned — age alone would delete it.
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
                SELECT 1 FROM actor_profile_versions p
                WHERE p.avatar_id = m.id OR p.cover_id = m.id)
          AND NOT EXISTS (SELECT 1 FROM chat_versions c WHERE c.image_id = m.id)
        RETURNING id, storage_key
        "#,
        max_age_secs,
    )
    .fetch_all(pool)
    .await
}
