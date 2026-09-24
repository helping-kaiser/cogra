//! ´mod:module:media´
//!
//! Media asset rows — the SQL half of the api crate's media module.
//!
//! An asset row is a pure asset: metadata about bytes, with no pointer to
//! any parent. Parents point at assets and assets never point back, so
//! the natural query is always parent to attachments (data-model.md "Why
//! parents point at attachments").
//!
//! An asset row is **immutable once it is ready**: the digest names the
//! bytes permanently and the object is cacheable forever. Before that it
//! is `processing` — the upload has landed but its final bytes do not
//! exist yet — and the only update surface is the ingest worker's, which
//! moves a row to `ready` or `failed` exactly once. Prepare refuses any
//! asset that is not `ready`, so no envelope ever commits a digest that
//! could still change. Neither a description nor a poster is the asset's to
//! hold — both ride the payload envelope and the junction row caches them
//! per version, so writing a description or naming a different cover is a
//! new version of the parent and the bytes never move again (data-model.md
//! "Media attachments").
//!
//! That is also why the same asset can read differently in two parents:
//! the description and the poster belong to the placement, and each
//! version's junction row carries what that version's manifest witnessed.
//!
//! `author_id` here is Postgres-native truth rather than a cached
//! derivation — media is not a graph node, so there is no graph-side
//! authorship to cache from.

use chrono::{DateTime, Utc};
use sqlx::postgres::{PgTypeInfo, PgValueRef};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

/// Where an asset stands between its upload and its first use.
///
/// Stored as text under a CHECK, the shape every state column in the
/// schema uses, and decoded straight into this type so no caller ever
/// compares strings.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AssetState {
    /// The upload landed and its final bytes do not exist yet. Nothing may
    /// reference it: the digest it carries now is not the one it will be
    /// served under.
    Processing,
    /// The stored bytes are final and the digest names them.
    Ready,
    /// The upload could not be made servable; `failure_reason` says why.
    Failed,
}

impl AssetState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Processing => "processing",
            Self::Ready => "ready",
            Self::Failed => "failed",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "processing" => Self::Processing,
            "ready" => Self::Ready,
            "failed" => Self::Failed,
            _ => return None,
        })
    }
}

impl sqlx::Type<Postgres> for AssetState {
    fn type_info() -> PgTypeInfo {
        <&str as sqlx::Type<Postgres>>::type_info()
    }

    fn compatible(ty: &PgTypeInfo) -> bool {
        <&str as sqlx::Type<Postgres>>::compatible(ty)
    }
}

impl<'r> sqlx::Decode<'r, Postgres> for AssetState {
    fn decode(value: PgValueRef<'r>) -> Result<Self, sqlx::error::BoxDynError> {
        let raw = <&str as sqlx::Decode<Postgres>>::decode(value)?;
        Self::parse(raw).ok_or_else(|| format!("unknown media asset state {raw:?}").into())
    }
}

/// The destination an upload is sized for: a post or a comment.
///
/// A comment carries half a post's video, so the destination is the cap an
/// upload is planned and validated against. Stored as text under a CHECK,
/// the same shape as [`AssetState`], on the asset row — the ingest worker
/// re-encodes long after the request that named it — and on the upload
/// session, which processes its bytes only when it completes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MediaScale {
    Post,
    Comment,
}

impl MediaScale {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Post => "post",
            Self::Comment => "comment",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "post" => Self::Post,
            "comment" => Self::Comment,
            _ => return None,
        })
    }
}

impl sqlx::Type<Postgres> for MediaScale {
    fn type_info() -> PgTypeInfo {
        <&str as sqlx::Type<Postgres>>::type_info()
    }

    fn compatible(ty: &PgTypeInfo) -> bool {
        <&str as sqlx::Type<Postgres>>::compatible(ty)
    }
}

impl<'r> sqlx::Decode<'r, Postgres> for MediaScale {
    fn decode(value: PgValueRef<'r>) -> Result<Self, sqlx::error::BoxDynError> {
        let raw = <&str as sqlx::Decode<Postgres>>::decode(value)?;
        Self::parse(raw).ok_or_else(|| format!("unknown media scale {raw:?}").into())
    }
}

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
    pub options: serde_json::Value,
    pub state: AssetState,
    /// Why the asset failed, in words its author can read. Present exactly
    /// when `state` is `Failed` — a CHECK holds the two together.
    pub failure_reason: Option<String>,
    /// The erasure slice's columns. Nothing in the repo writes them yet —
    /// the slice is unbuilt, deliberately, and the read surfaces that
    /// branch on them are ahead of it rather than dead. The direction
    /// they will be built in is recorded in docs/open-questions.md:
    /// redaction marks the *usage* — a post or comment version, a gallery
    /// junction row — rather than the asset, so an innocent picture that
    /// was once in a redacted gallery is never permanently unusable.
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

/// Records an uploaded asset whose bytes are already final, or returns
/// the one this author already has for these bytes.
///
/// The caller tells the two cases apart by comparing the returned
/// `storage_key` against the one it generated: a different key means the
/// row was already there and the object just written is an orphan to
/// collect.
///
/// Uniqueness is on `(author_id, digest)`, never on the digest alone: two
/// authors uploading identical bytes get two rows and two objects, so
/// removing one author's asset can never break the other's render.
///
/// The key is here for resolution rather than for storage: the signed
/// envelope's manifest names attachments by digest, and
/// [`assets_by_digests`] can only turn a manifest back into rows because
/// an author and a digest name at most one asset. Storage is the cheap
/// resource; ambiguity here is not.
///
/// A retry is answered with whatever row was already there, redaction
/// columns included — so once the erasure slice exists, a re-upload of
/// bytes whose usage was redacted hands the caller back the existing
/// asset. That is the intended answer under the direction recorded in
/// docs/open-questions.md: redaction marks the usage, not the bytes, so
/// the row is still a perfectly good asset to attach somewhere else.
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
    options: &serde_json::Value,
    scale: MediaScale,
) -> Result<MediaAttachment, sqlx::Error> {
    write_asset(
        pool,
        NewAsset {
            id,
            author_id,
            digest,
            digest_algo,
            storage_key,
            mime_type,
            size_bytes,
            options,
            scale,
            state: AssetState::Ready,
            source_digest: None,
        },
    )
    .await
}

/// Records an uploaded asset that still has to be re-encoded, or returns
/// the one this author already has for these bytes.
///
/// The row is `processing` and carries the digest of the bytes as they
/// arrived — in `digest`, because the column is what the retry rule
/// reads while the asset is in flight, and in `source_digest`, which
/// outlives the transcode: once the row is `ready` its `digest` names the
/// rendition, and a retried upload of the same file still has to find it.
#[allow(clippy::too_many_arguments)]
pub async fn insert_processing(
    pool: &PgPool,
    id: Uuid,
    author_id: Uuid,
    digest: &[u8],
    digest_algo: &str,
    storage_key: &str,
    mime_type: &str,
    size_bytes: i64,
    options: &serde_json::Value,
    scale: MediaScale,
) -> Result<MediaAttachment, sqlx::Error> {
    write_asset(
        pool,
        NewAsset {
            id,
            author_id,
            digest,
            digest_algo,
            storage_key,
            mime_type,
            size_bytes,
            options,
            scale,
            state: AssetState::Processing,
            source_digest: Some(digest),
        },
    )
    .await
}

/// Everything the two inserts share.
struct NewAsset<'a> {
    id: Uuid,
    author_id: Uuid,
    digest: &'a [u8],
    digest_algo: &'a str,
    storage_key: &'a str,
    mime_type: &'a str,
    size_bytes: i64,
    options: &'a serde_json::Value,
    scale: MediaScale,
    state: AssetState,
    source_digest: Option<&'a [u8]>,
}

/// The asset an upload of these bytes already produced, or a fresh row.
///
/// Three statements rather than one upsert, because an upload has two
/// digests to be recognised by — the one it arrived with and, once it is
/// re-encoded, the one it is served under — and `ON CONFLICT` names one
/// arbiter. The read comes first; the insert takes `DO NOTHING` on any
/// conflict, which Postgres resolves only after a concurrent inserter of
/// the same key has committed; and the second read then sees the row that
/// won. A failed asset is never the answer: it holds its digests no
/// longer, so the same file can be uploaded again once the cause is gone.
async fn write_asset(pool: &PgPool, new: NewAsset<'_>) -> Result<MediaAttachment, sqlx::Error> {
    if let Some(row) = upload_of(pool, new.author_id, new.digest).await? {
        return Ok(row);
    }
    let inserted = sqlx::query_as!(
        MediaAttachment,
        r#"
        INSERT INTO media_attachments
            (id, author_id, digest, digest_algo, storage_key,
             mime_type, size_bytes, options, state, source_digest, scale)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT DO NOTHING
        RETURNING id, author_id, digest, digest_algo, storage_key,
                  mime_type, size_bytes,
                  options AS "options!: serde_json::Value",
                  state AS "state: AssetState", failure_reason,
                  redaction_reason, redacted_at, created_at
        "#,
        new.id,
        new.author_id,
        new.digest,
        new.digest_algo,
        new.storage_key,
        new.mime_type,
        new.size_bytes,
        new.options,
        new.state.as_str(),
        new.source_digest,
        new.scale.as_str(),
    )
    .fetch_optional(pool)
    .await?;
    if let Some(row) = inserted {
        return Ok(row);
    }
    upload_of(pool, new.author_id, new.digest)
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

/// The live asset this author's upload of these bytes produced, by either
/// of its digests.
async fn upload_of(
    pool: &PgPool,
    author_id: Uuid,
    digest: &[u8],
) -> Result<Option<MediaAttachment>, sqlx::Error> {
    sqlx::query_as!(
        MediaAttachment,
        r#"
        SELECT id, author_id, digest, digest_algo, storage_key,
               mime_type, size_bytes,
               options AS "options!: serde_json::Value",
               state AS "state: AssetState", failure_reason,
               redaction_reason, redacted_at, created_at
        FROM media_attachments
        WHERE author_id = $1
          AND state <> 'failed'
          AND (digest = $2 OR source_digest = $2)
        ORDER BY created_at
        LIMIT 1
        "#,
        author_id,
        digest,
    )
    .fetch_optional(pool)
    .await
}

/// A `processing` asset a worker holds the lease on.
#[derive(Debug, Clone)]
pub struct IngestJob {
    pub id: Uuid,
    pub author_id: Uuid,
    /// Where the bytes as they arrived are stored.
    pub storage_key: String,
    pub mime_type: String,
    pub options: serde_json::Value,
    /// The destination the upload named, whose cap the re-encode plans
    /// for and the rendition is validated against.
    pub scale: MediaScale,
    /// How many times a worker has claimed this row, this claim included.
    pub attempts: i32,
}

/// Leases the oldest `processing` asset nobody holds.
///
/// `FOR UPDATE SKIP LOCKED` is the queue idiom Postgres documents for
/// exactly this — "to avoid lock contention with multiple consumers
/// accessing a queue-like table" — so two workers never claim the same
/// row and neither waits on the other. The claim is a lease rather than a
/// held lock: the row lock lasts one statement, and what keeps a second
/// worker away afterwards is `lease_until`. A worker that dies stops
/// renewing it, and its row is claimable again when the lease lapses —
/// which is how a restart picks up what was in flight.
pub async fn claim_ingest(
    pool: &PgPool,
    lease_secs: f64,
) -> Result<Option<IngestJob>, sqlx::Error> {
    sqlx::query_as!(
        IngestJob,
        r#"
        UPDATE media_attachments
        SET lease_until = now() + make_interval(secs => $1),
            attempts    = attempts + 1
        WHERE id = (
            SELECT id FROM media_attachments
            WHERE state = 'processing'
              AND (lease_until IS NULL OR lease_until < now())
            ORDER BY created_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        RETURNING id, author_id, storage_key, mime_type,
                  options AS "options!: serde_json::Value",
                  scale AS "scale: MediaScale", attempts
        "#,
        lease_secs,
    )
    .fetch_optional(pool)
    .await
}

/// Extends a lease the worker still holds. False when the row is no longer
/// `processing` — swept, or settled by someone else — which tells the
/// worker its result has nowhere to go.
pub async fn renew_ingest_lease(
    pool: &PgPool,
    id: Uuid,
    lease_secs: f64,
) -> Result<bool, sqlx::Error> {
    let renewed = sqlx::query!(
        "UPDATE media_attachments
         SET lease_until = now() + make_interval(secs => $2)
         WHERE id = $1 AND state = 'processing'",
        id,
        lease_secs,
    )
    .execute(pool)
    .await?;
    Ok(renewed.rows_affected() == 1)
}

/// Hands a lease back after a failure worth retrying, holding the row off
/// for `retry_after_secs` so a fault that is still there is not hit again
/// at once. The same statement as a renewal: what differs is only that
/// nobody renews it again, so it lapses when the wait is over.
pub async fn release_ingest(
    pool: &PgPool,
    id: Uuid,
    retry_after_secs: f64,
) -> Result<(), sqlx::Error> {
    renew_ingest_lease(pool, id, retry_after_secs).await?;
    Ok(())
}

/// The final bytes of a re-encoded asset, as the row will describe them.
#[derive(Debug, Clone, Copy)]
pub struct Rendition<'a> {
    pub digest: &'a [u8],
    pub storage_key: &'a str,
    pub size_bytes: i64,
    pub options: &'a serde_json::Value,
}

/// Settles a `processing` asset as `ready`, pointing it at its rendition.
///
/// This is the one moment an asset's digest changes, and it is safe for
/// exactly one reason: nothing can have committed the old one, because
/// prepare refuses an asset that is not `ready`. `None` when the row is no
/// longer `processing` — the rendition then belongs to nobody and the
/// caller deletes it.
///
/// A unique violation here means this author already holds a live asset
/// with the rendition's digest; the caller settles the row as failed.
pub async fn finish_ingest(
    pool: &PgPool,
    id: Uuid,
    rendition: Rendition<'_>,
) -> Result<Option<MediaAttachment>, sqlx::Error> {
    sqlx::query_as!(
        MediaAttachment,
        r#"
        UPDATE media_attachments
        SET state       = 'ready',
            digest      = $2,
            storage_key = $3,
            size_bytes  = $4,
            options     = $5,
            lease_until = NULL
        WHERE id = $1 AND state = 'processing'
        RETURNING id, author_id, digest, digest_algo, storage_key,
                  mime_type, size_bytes,
                  options AS "options!: serde_json::Value",
                  state AS "state: AssetState", failure_reason,
                  redaction_reason, redacted_at, created_at
        "#,
        id,
        rendition.digest,
        rendition.storage_key,
        rendition.size_bytes,
        rendition.options,
    )
    .fetch_optional(pool)
    .await
}

/// Settles a `processing` asset as `failed`, with the reason its author
/// will read. False when the row was no longer `processing`.
pub async fn fail_ingest(pool: &PgPool, id: Uuid, reason: &str) -> Result<bool, sqlx::Error> {
    let failed = sqlx::query!(
        "UPDATE media_attachments
         SET state = 'failed', failure_reason = $2, lease_until = NULL
         WHERE id = $1 AND state = 'processing'",
        id,
        reason,
    )
    .execute(pool)
    .await?;
    Ok(failed.rows_affected() == 1)
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
    /// The description this version's manifest witnessed for this
    /// placement — a fact about the parent–asset relationship, which is
    /// why the same asset can read differently in two parents.
    pub alt_text: Option<String>,
    /// The poster this version's manifest witnessed for this placement —
    /// the still a video shows before playback. A placement fact for the
    /// same reason `alt_text` is, which is what lets an edit name a
    /// different cover without touching an immutable clip row.
    ///
    /// Distinct from `is_cover`, which answers which attachment *leads* a
    /// multi-asset parent rather than what covers a single one.
    pub cover_media_id: Option<Uuid>,
    /// Whether that poster was taken from the clip rather than chosen by
    /// its author — witnessed beside the cover it qualifies, so it is only
    /// ever true on a placement that names one.
    pub cover_taken: bool,
}

/// One entry of a gallery as it is written: the asset, the description the
/// record witnessed for it, the poster it named, and whether that poster
/// was taken.
///
/// All four come out of the payload envelope's manifest at promotion,
/// never out of the request that produced it — the digest names the asset,
/// per-asset map key 2 names the description, key 3 the cover and key 4
/// the taken mark (data-model.md "The payload envelope"). That is what
/// makes a gallery rebuildable from the record.
#[derive(Debug, Clone)]
pub struct GalleryPlacement {
    pub attachment_id: Uuid,
    pub alt_text: Option<String>,
    pub cover_media_id: Option<Uuid>,
    pub cover_taken: bool,
}

/// Writes one version's gallery, in order.
///
/// Position is the order: `display_order` is the index and the cover is
/// index 0, the same convention the payload envelope's manifest carries
/// (`common::envelope::MediaAsset`, whose array position is the gallery
/// order). Storing a second, independent index would let Postgres and the
/// witnessed record disagree about what a reader sees. `alt_text` is the
/// same fact said twice for the same reason — the row caches what the
/// manifest entry carried, so a read serves the version's own description
/// without decoding a payload. `cover_media_id` and `cover_taken` ride
/// along on the same terms, from per-asset map keys 3 and 4.
///
/// Idempotent on re-running the write that produced it: a retried
/// pre-sign re-inserts the same rows onto the same version.
pub async fn attach_to_post_version(
    tx: &mut Transaction<'_, Postgres>,
    post_version_id: i64,
    gallery: &[GalleryPlacement],
) -> Result<(), sqlx::Error> {
    if gallery.is_empty() {
        return Ok(());
    }
    let (ids, orders, alts, covers, taken) = split_placements(gallery)?;
    sqlx::query!(
        "INSERT INTO post_attachments
             (post_version_id, attachment_id, display_order, is_cover, alt_text,
              cover_media_id, cover_taken)
         SELECT $1, a.id, a.ord, a.ord = 0, a.alt, a.cover, a.taken
         FROM unnest($2::uuid[], $3::smallint[], $4::text[], $5::uuid[], $6::bool[])
              AS a(id, ord, alt, cover, taken)
         ON CONFLICT (post_version_id, attachment_id) DO NOTHING",
        post_version_id,
        &ids,
        &orders,
        &alts as &[Option<String>],
        &covers as &[Option<Uuid>],
        &taken,
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
    gallery: &[GalleryPlacement],
) -> Result<(), sqlx::Error> {
    if gallery.is_empty() {
        return Ok(());
    }
    let (ids, orders, alts, covers, taken) = split_placements(gallery)?;
    sqlx::query!(
        "INSERT INTO comment_attachments
             (comment_version_id, attachment_id, display_order, alt_text,
              cover_media_id, cover_taken)
         SELECT $1, a.id, a.ord, a.alt, a.cover, a.taken
         FROM unnest($2::uuid[], $3::smallint[], $4::text[], $5::uuid[], $6::bool[])
              AS a(id, ord, alt, cover, taken)
         ON CONFLICT (comment_version_id, attachment_id) DO NOTHING",
        comment_version_id,
        &ids,
        &orders,
        &alts as &[Option<String>],
        &covers as &[Option<Uuid>],
        &taken,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The five parallel arrays one gallery is bound as.
type GalleryArrays = (
    Vec<Uuid>,
    Vec<i16>,
    Vec<Option<String>>,
    Vec<Option<Uuid>>,
    Vec<bool>,
);

/// The gallery as the five parallel arrays `unnest` zips back together.
/// One `unnest` over parallel arrays is what keeps the whole gallery one
/// statement, and the arrays have to be built before the query borrows
/// them.
///
/// All five are built in one pass so their lengths cannot diverge:
/// `unnest` pads the short arrays of a ragged set with NULL, and
/// `attachment_id`, `display_order` and `cover_taken` are `NOT NULL`, so a
/// divergence is either a refused statement or wrong rows — never a
/// visible mismatch.
///
/// `display_order` is a `smallint`, so a gallery longer than `i16::MAX` is
/// refused rather than wrapped. A wrapped index would restart the ordering
/// at a negative number, and `is_cover` is derived as `ord = 0`, so the
/// cover would move to whichever placement happened to land on zero.
fn split_placements(gallery: &[GalleryPlacement]) -> Result<GalleryArrays, sqlx::Error> {
    let mut ids = Vec::with_capacity(gallery.len());
    let mut orders = Vec::with_capacity(gallery.len());
    let mut alts = Vec::with_capacity(gallery.len());
    let mut covers = Vec::with_capacity(gallery.len());
    let mut taken = Vec::with_capacity(gallery.len());
    for (index, placement) in gallery.iter().enumerate() {
        let order = i16::try_from(index).map_err(|_| {
            sqlx::Error::Encode(
                format!(
                    "gallery of {} placements exceeds display_order",
                    gallery.len()
                )
                .into(),
            )
        })?;
        ids.push(placement.attachment_id);
        orders.push(order);
        alts.push(placement.alt_text.clone());
        covers.push(placement.cover_media_id);
        taken.push(placement.cover_taken);
    }
    Ok((ids, orders, alts, covers, taken))
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
    cover_media_id: Option<Uuid>,
    cover_taken: bool,
    state: AssetState,
    failure_reason: Option<String>,
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
                options: row.options,
                state: row.state,
                failure_reason: row.failure_reason,
                redaction_reason: row.redaction_reason,
                redacted_at: row.redacted_at,
                created_at: row.created_at,
            },
            display_order: row.display_order,
            is_cover: row.is_cover,
            alt_text: row.alt_text,
            cover_media_id: row.cover_media_id,
            cover_taken: row.cover_taken,
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
                  j.is_cover, j.alt_text, j.cover_media_id, j.cover_taken,
                  m.id, m.author_id, m.digest, m.digest_algo, m.storage_key,
                  m.mime_type, m.size_bytes,
                  m.options AS "options!: serde_json::Value",
                  m.state AS "state: AssetState", m.failure_reason,
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
                  FALSE AS "is_cover!", j.alt_text, j.cover_media_id, j.cover_taken,
                  m.id, m.author_id, m.digest, m.digest_algo, m.storage_key,
                  m.mime_type, m.size_bytes,
                  m.options AS "options!: serde_json::Value",
                  m.state AS "state: AssetState", m.failure_reason,
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
///
/// Only `ready` rows answer. A manifest can only ever name a ready asset —
/// prepare refuses any other — so this is a statement of that rule at the
/// read rather than a filter anything relies on.
pub async fn assets_by_digests(
    pool: &PgPool,
    author_id: Uuid,
    digests: &[Vec<u8>],
) -> Result<Vec<MediaAttachment>, sqlx::Error> {
    sqlx::query_as!(
        MediaAttachment,
        r#"
        SELECT id, author_id, digest, digest_algo, storage_key,
               mime_type, size_bytes,
               options AS "options!: serde_json::Value",
               state AS "state: AssetState", failure_reason,
               redaction_reason, redacted_at, created_at
        FROM media_attachments
        WHERE author_id = $1 AND digest = ANY($2) AND state = 'ready'
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
               mime_type, size_bytes,
               options AS "options!: serde_json::Value",
               state AS "state: AssetState", failure_reason,
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
               mime_type, size_bytes,
               options AS "options!: serde_json::Value",
               state AS "state: AssetState", failure_reason,
               redaction_reason, redacted_at, created_at
        FROM media_attachments
        WHERE id = $1
        "#,
        id,
    )
    .fetch_optional(pool)
    .await
}

/// An upload in progress: what the server must remember to finish it
/// after the connection that started it is gone.
#[derive(Debug, Clone)]
pub struct UploadSession {
    pub id: Uuid,
    pub author_id: Uuid,
    pub storage_key: String,
    pub upload_id: String,
    pub declared_bytes: i64,
    pub part_size_bytes: i32,
    pub part_count: i32,
    /// The destination named when the session opened, which the
    /// assembled bytes are processed for at completion.
    pub scale: MediaScale,
    /// The asset a finished session produced, and the reason a retried
    /// completion is cheap: set, it is the answer; null, the upload is
    /// still open.
    pub media_id: Option<Uuid>,
    pub expires_at: DateTime<Utc>,
}

/// One part the store has acknowledged.
#[derive(Debug, Clone)]
pub struct UploadPart {
    pub part_number: i32,
    pub content_id: String,
    pub size_bytes: i32,
}

/// Opens a session. The row is written after the store's multipart
/// upload exists, so `upload_id` always names something real.
#[allow(clippy::too_many_arguments)]
pub async fn open_upload_session(
    pool: &PgPool,
    id: Uuid,
    author_id: Uuid,
    storage_key: &str,
    upload_id: &str,
    declared_bytes: i64,
    part_size_bytes: i32,
    part_count: i32,
    scale: MediaScale,
    ttl_secs: f64,
) -> Result<UploadSession, sqlx::Error> {
    sqlx::query_as!(
        UploadSession,
        r#"
        INSERT INTO media_upload_sessions
            (id, author_id, storage_key, upload_id, declared_bytes,
             part_size_bytes, part_count, scale, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + make_interval(secs => $9))
        RETURNING id, author_id, storage_key, upload_id, declared_bytes,
                  part_size_bytes, part_count, scale AS "scale: MediaScale",
                  media_id, expires_at
        "#,
        id,
        author_id,
        storage_key,
        upload_id,
        declared_bytes,
        part_size_bytes,
        part_count,
        scale.as_str(),
        ttl_secs,
    )
    .fetch_one(pool)
    .await
}

/// The session, if it is this author's and has not expired.
///
/// Expiry is applied in the query rather than compared by the caller so
/// that a session the sweeper has not reached yet still behaves as gone.
/// Otherwise the window between expiry and the next sweep would be a
/// window in which an upload the server has promised to collect still
/// accepts parts.
pub async fn upload_session(
    pool: &PgPool,
    id: Uuid,
    author_id: Uuid,
) -> Result<Option<UploadSession>, sqlx::Error> {
    sqlx::query_as!(
        UploadSession,
        r#"
        SELECT id, author_id, storage_key, upload_id, declared_bytes,
               part_size_bytes, part_count, scale AS "scale: MediaScale",
               media_id, expires_at
        FROM media_upload_sessions
        WHERE id = $1 AND author_id = $2 AND expires_at > now()
        "#,
        id,
        author_id,
    )
    .fetch_optional(pool)
    .await
}

/// Records a part, replacing any earlier attempt at the same number.
///
/// The upsert is the idempotency this whole path is built on: the store
/// overwrites a re-sent part's bytes, and this overwrites the identifier
/// that names them, so the two never disagree about which attempt is
/// current.
pub async fn record_upload_part(
    pool: &PgPool,
    session_id: Uuid,
    part_number: i32,
    content_id: &str,
    size_bytes: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO media_upload_parts
            (session_id, part_number, content_id, size_bytes)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (session_id, part_number)
            DO UPDATE SET content_id  = EXCLUDED.content_id,
                          size_bytes  = EXCLUDED.size_bytes,
                          uploaded_at = now()
        "#,
        session_id,
        part_number,
        content_id,
        size_bytes,
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// The session's parts in assembly order — the order a completion has to
/// quote them in, since the store concatenates by ascending part number.
pub async fn upload_parts(pool: &PgPool, session_id: Uuid) -> Result<Vec<UploadPart>, sqlx::Error> {
    sqlx::query_as!(
        UploadPart,
        r#"
        SELECT part_number, content_id, size_bytes
        FROM media_upload_parts
        WHERE session_id = $1
        ORDER BY part_number
        "#,
        session_id,
    )
    .fetch_all(pool)
    .await
}

/// Marks the session as having produced this asset.
///
/// This is the commit point of a completion: from here a retry is
/// answered out of the row instead of re-assembling anything.
pub async fn finish_upload_session(
    pool: &PgPool,
    id: Uuid,
    media_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE media_upload_sessions SET media_id = $2 WHERE id = $1",
        id,
        media_id,
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Drops a session and its parts.
///
/// **The store is released first here, and the row dropped after** —
/// the opposite of the asset sweep's order, deliberately. That sweep
/// writes rows first because a row pointing at nothing is a render that
/// can never succeed, while an unreferenced object is merely garbage. A
/// session row renders nothing, so the asymmetry that justifies the
/// order does not exist; what matters instead is that the row is the
/// only handle anything has on the store-side upload. Drop it while the
/// upload still lives and its parts become unreachable — billed and
/// collectable by nothing this server runs. Kept until the abort
/// succeeds, a failed abort simply leaves the row for the next sweep to
/// retry, and the cleanup converges.
pub async fn close_upload_session(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query!("DELETE FROM media_upload_sessions WHERE id = $1", id)
        .execute(pool)
        .await?;
    Ok(())
}

/// A session the sweep is about to collect, and what the store still
/// holds for it.
#[derive(Debug, Clone)]
pub struct ExpiredUpload {
    pub id: Uuid,
    pub storage_key: String,
    pub upload_id: String,
    /// Whether the session ever produced an asset. A finished session has
    /// nothing left in the store; an unfinished one is still holding
    /// parts that only an abort releases.
    pub unfinished: bool,
}

/// Sessions past their expiry, oldest first.
///
/// Read rather than deleted, because the caller has store-side work to do
/// per row and the row is the only handle on it — see
/// [`close_upload_session`] for why that inverts the asset sweep's order.
///
/// An upload nobody finished is worse than an orphaned object: until it
/// is aborted the store keeps every part, bills for them, and serves them
/// to no one. So this is not the asset sweep's optional sibling — it is
/// the only thing that ever releases those parts.
///
/// Finished sessions are collected on the same pass. They are kept until
/// expiry on purpose: while the row lives, a client that lost the
/// completion's reply is handed the asset back instead of a refusal, and
/// that window is exactly what makes a blip during completion survivable.
///
/// The limit bounds one tick's work. A backlog is drained over several
/// ticks rather than in one long transaction, so a sweep that falls
/// behind never becomes a sweep that blocks.
pub async fn expired_upload_sessions(
    pool: &PgPool,
    limit: i64,
) -> Result<Vec<ExpiredUpload>, sqlx::Error> {
    sqlx::query_as!(
        ExpiredUpload,
        r#"
        SELECT id, storage_key, upload_id,
               (media_id IS NULL) AS "unfinished!"
        FROM media_upload_sessions
        WHERE expires_at <= now()
        ORDER BY expires_at
        LIMIT $1
        "#,
        limit,
    )
    .fetch_all(pool)
    .await
}

/// Collects assets nobody kept.
///
/// An upload precedes the write that references it, so a compose the
/// author abandoned leaves a row and an object that no parent will ever
/// point at. Nothing else collects them: staged writes have their own
/// epoch-denominated GC, and an asset is not a staged write. A `failed`
/// asset is one of these by construction — nothing may reference it — and
/// ages out the same way, as would a `processing` one the ingest worker
/// never settled.
///
/// **The join is the seam.** "Orphaned" means no reference from any of
/// the four content junctions, none from the profile and chat image
/// columns, none from a post or comment placement that names this asset
/// as its poster, and none from the upload session that produced it.
/// Every one of those references is checked here, in one query,
/// deliberately: a reference this list misses is an asset deleted out from
/// under a live parent, so the list must be extended in the same change
/// that adds a way to reference an asset.
///
/// The session probe is the newest of them and the least obvious. A
/// finished session holds its asset's id so a retried completion can be
/// answered without re-assembling anything; without this probe an asset
/// nobody attached would age out while its session still pointed at it,
/// and the foreign key would refuse the delete — failing not that row but
/// the whole sweep, so nothing would ever be collected again.
///
/// The poster probes are two rather than one because a cover is named on
/// the placement: a post placement and a comment placement can each name
/// it, and an asset serving as a poster is referenced by neither junction's
/// `attachment_id`. Without both, the sweep would collect a poster the
/// moment it aged past the window and leave its video pointing at a row
/// that no longer exists — the exact failure the paragraph above is a
/// standing instruction against.
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
/// Each `NOT EXISTS` is an index probe of the referencing column — the
/// four junctions' reverse index on `attachment_id`, the two version
/// tables' partial index on the picture column, the post and comment
/// junctions' partial index on `cover_media_id`, and the session table's
/// `media_id`. Postgres creates
/// no index behind a foreign key, so without them each probe is a
/// sequential scan and so is the delete's own integrity re-check. A new
/// way to reference an asset owes this list a probe *and* that column an
/// index, in the same change.
///
/// Rows are deleted and their keys returned; the caller removes the
/// objects. Doing it in that order means a crash between the two leaves
/// an unreferenced object rather than a row pointing at nothing.
///
/// The limit bounds one tick's work, for the reason
/// [`expired_upload_sessions`] states: a backlog is drained over several
/// ticks rather than in one transaction that holds row locks on every
/// candidate at once — and each of those locks is contended, because a
/// gallery write takes a `FOR KEY SHARE` lock on the asset it references
/// as its own foreign-key check. Oldest first, so the drain converges.
///
/// The candidate select and the delete share one statement and therefore
/// one snapshot, so bounding the work does not widen the window in which
/// an asset could be referenced between being chosen and being removed.
pub async fn sweep_orphans(
    pool: &PgPool,
    max_age_secs: f64,
    limit: i64,
) -> Result<Vec<SweptAsset>, sqlx::Error> {
    sqlx::query_as!(
        SweptAsset,
        r#"
        WITH candidates AS (
            SELECT m.id
            FROM media_attachments m
            WHERE m.created_at <= now() - make_interval(secs => $1)
              AND NOT EXISTS (SELECT 1 FROM post_attachments         a WHERE a.attachment_id = m.id)
              AND NOT EXISTS (SELECT 1 FROM comment_attachments      a WHERE a.attachment_id = m.id)
              AND NOT EXISTS (SELECT 1 FROM chat_message_attachments a WHERE a.attachment_id = m.id)
              AND NOT EXISTS (SELECT 1 FROM item_attachments         a WHERE a.attachment_id = m.id)
              AND NOT EXISTS (
                    SELECT 1 FROM actor_profile_versions p WHERE p.avatar_id = m.id)
              AND NOT EXISTS (SELECT 1 FROM chat_versions c WHERE c.image_id = m.id)
              AND NOT EXISTS (
                    SELECT 1 FROM post_attachments    a WHERE a.cover_media_id = m.id)
              AND NOT EXISTS (
                    SELECT 1 FROM comment_attachments a WHERE a.cover_media_id = m.id)
              AND NOT EXISTS (
                    SELECT 1 FROM media_upload_sessions s WHERE s.media_id = m.id)
            ORDER BY m.created_at
            LIMIT $2
        )
        DELETE FROM media_attachments m
        USING candidates c
        WHERE m.id = c.id
        RETURNING m.id, m.storage_key
        "#,
        max_age_secs,
        limit,
    )
    .fetch_all(pool)
    .await
}

#[cfg(test)]
mod placement_tests {
    use super::{GalleryPlacement, split_placements};
    use uuid::Uuid;

    fn placement(n: u128, alt: Option<&str>, cover: Option<u128>) -> GalleryPlacement {
        GalleryPlacement {
            attachment_id: Uuid::from_u128(n),
            alt_text: alt.map(str::to_string),
            cover_media_id: cover.map(Uuid::from_u128),
            cover_taken: false,
        }
    }

    /// The five arrays are one gallery said five ways, so they have to
    /// come out the same length and in the same order — `unnest` pads a
    /// ragged set with NULL, and three of the five columns are NOT NULL.
    ///
    /// A gallery's five bound arrays agree on length and on order.
    /// ´claim:media:a-gallerys-arrays-cannot-diverge´
    #[test]
    fn the_five_arrays_agree_on_length_and_order() {
        let gallery = [
            placement(1, Some("first"), None),
            GalleryPlacement {
                cover_taken: true,
                ..placement(2, None, Some(9))
            },
            placement(3, Some("third"), None),
        ];
        let (ids, orders, alts, covers, taken) = split_placements(&gallery).expect("fits");
        assert_eq!(
            ids,
            vec![Uuid::from_u128(1), Uuid::from_u128(2), Uuid::from_u128(3)]
        );
        assert_eq!(orders, vec![0, 1, 2]);
        assert_eq!(
            alts,
            vec![Some("first".to_string()), None, Some("third".to_string())]
        );
        assert_eq!(covers, vec![None, Some(Uuid::from_u128(9)), None]);
        assert_eq!(taken, vec![false, true, false]);
    }

    /// Position is the order and index 0 is the cover, so the first
    /// placement is the one `is_cover` will pick out.
    ///
    /// The first placement holds position zero, which is the cover.
    /// ´claim:media:the-first-placement-is-the-cover´
    #[test]
    fn the_first_placement_holds_position_zero() {
        let (_, orders, ..) = split_placements(&[placement(1, None, None)]).expect("fits");
        assert_eq!(orders, vec![0]);
        assert!(split_placements(&[]).expect("fits").0.is_empty());
    }
}
