// Display content for the content slice (data-model.md "Content nodes",
// "Display-content versioning"): immutable entity rows bound to their
// minted L1 node, append-only version rows, and the act payload carriage.
// An entity row is written at the pre-commitment signature and carries a
// pending mark — absent landing coordinates — until confirm fills them in
// (substrate.md §6: a prepared record is its author's content from the
// moment they sign it). The landing-order columns cache the genesis
// record's authoritative causal key; like every mirror-derived column
// they are rebuildable and never authoritative (data-model.md "The
// Boundary Rule").

use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

type Timestamp = chrono::DateTime<chrono::Utc>;

#[derive(Debug, thiserror::Error)]
pub enum ContentError {
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
}

/// The sentinel epoch a pending entry sorts under (api-spec.md
/// "Pagination"): above every real epoch, so newest-first ordering puts
/// pending entries ahead of the newest landed one and the cursor keeps
/// its `(epoch, act time, position)` form. Pending entries sort among
/// themselves by authoring instant, in microseconds.
pub const PENDING_EPOCH: i64 = i64::MAX;

/// The genesis record's landing coordinates — the listing sort key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct LandingOrder {
    pub landed_epoch: i64,
    pub act_time: i64,
    pub position: i64,
}

impl LandingOrder {
    /// Whether the key names the pending namespace rather than a landed
    /// record — the one branch of a listing walk it can be in.
    pub fn is_pending(&self) -> bool {
        self.landed_epoch == PENDING_EPOCH
    }

    /// The pending key of an item authored at `created_at`.
    fn pending_at(created_at: Timestamp) -> Self {
        Self {
            landed_epoch: PENDING_EPOCH,
            act_time: created_at.timestamp_micros(),
            position: 0,
        }
    }

    /// The authoring instant a pending key encodes; None for a landed key
    /// or an out-of-range value.
    fn pending_instant(&self) -> Option<Timestamp> {
        self.is_pending()
            .then(|| chrono::DateTime::from_timestamp_micros(self.act_time))
            .flatten()
    }
}

/// One post with its current display version (entity row + newest
/// version row).
#[derive(Debug, Clone)]
pub struct Post {
    pub id: Uuid,
    pub author_id: Uuid,
    pub l1_node_id: String,
    /// The genesis record's landing coordinates; None while the record
    /// is still pending.
    pub order: Option<LandingOrder>,
    pub created_at: Timestamp,
    pub title: Option<String>,
    pub description: Option<String>,
    pub content: String,
    pub redaction_reason: Option<String>,
    /// Whether the rendered version is an edit that has not landed.
    pub version_pending: bool,
    /// The current version row's timestamp — `updatedAt` when it differs
    /// from `created_at` (data-model.md: updated_at is derived, never
    /// stored).
    pub version_created_at: Timestamp,
}

impl Post {
    /// The listing sort key: the landing coordinates once landed, the
    /// pending sentinel key before.
    pub fn sort_key(&self) -> LandingOrder {
        self.order
            .unwrap_or_else(|| LandingOrder::pending_at(self.created_at))
    }
}

/// One comment with its current display version.
#[derive(Debug, Clone)]
pub struct Comment {
    pub id: Uuid,
    pub target_id: Uuid,
    pub target_type: String,
    pub author_id: Uuid,
    pub l1_node_id: String,
    pub order: Option<LandingOrder>,
    pub created_at: Timestamp,
    pub content: String,
    pub redaction_reason: Option<String>,
    pub version_pending: bool,
    pub version_created_at: Timestamp,
}

impl Comment {
    pub fn sort_key(&self) -> LandingOrder {
        self.order
            .unwrap_or_else(|| LandingOrder::pending_at(self.created_at))
    }
}

/// Inserts a post's entity row and its first version row. `order` is None
/// at the pre-commitment — the row is pending — and Some for a genesis
/// promoted without one (a mirror rebuild). Returns false when the row is
/// already there, so a retried pre-sign neither duplicates the version row
/// nor moves the authoring instant.
#[allow(clippy::too_many_arguments)]
pub async fn insert_post(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    author_id: Uuid,
    l1_node_id: &str,
    order: Option<LandingOrder>,
    created_at: Timestamp,
    title: Option<&str>,
    description: Option<&str>,
    content: &str,
) -> Result<bool, ContentError> {
    let inserted = sqlx::query!(
        "INSERT INTO posts
             (id, author_id, l1_node_id, landed_epoch, act_time, position,
              created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING",
        id,
        author_id,
        l1_node_id,
        order.map(|o| o.landed_epoch),
        order.map(|o| o.act_time),
        order.map(|o| o.position),
        created_at,
    )
    .execute(&mut **tx)
    .await?
    .rows_affected()
        == 1;
    if !inserted {
        return Ok(false);
    }
    sqlx::query!(
        "INSERT INTO post_versions
             (post_id, title, description, content, pending, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)",
        id,
        title,
        description,
        content,
        order.is_none(),
        created_at,
    )
    .execute(&mut **tx)
    .await?;
    Ok(true)
}

/// Appends a post version row — an edit. The caller supplies the full
/// merged field set (an edit's unchanged fields are copied forward so the
/// newest row alone renders the post — data-model.md "Display-content
/// versioning"). `pending` marks a version whose edit record has not
/// landed.
#[allow(clippy::too_many_arguments)]
pub async fn insert_post_version(
    tx: &mut Transaction<'_, Postgres>,
    post_id: Uuid,
    title: Option<&str>,
    description: Option<&str>,
    content: &str,
    pending: bool,
    created_at: Timestamp,
) -> Result<(), ContentError> {
    sqlx::query!(
        "INSERT INTO post_versions
             (post_id, title, description, content, pending, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (post_id, created_at) DO NOTHING",
        post_id,
        title,
        description,
        content,
        pending,
        created_at,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Inserts a comment's entity row and its first version row; same
/// pending/idempotence contract as [`insert_post`].
#[allow(clippy::too_many_arguments)]
pub async fn insert_comment(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    target_id: Uuid,
    target_type: &str,
    author_id: Uuid,
    l1_node_id: &str,
    order: Option<LandingOrder>,
    created_at: Timestamp,
    content: &str,
) -> Result<bool, ContentError> {
    let inserted = sqlx::query!(
        "INSERT INTO comments
             (id, target_id, target_type, author_id, l1_node_id,
              landed_epoch, act_time, position, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING",
        id,
        target_id,
        target_type,
        author_id,
        l1_node_id,
        order.map(|o| o.landed_epoch),
        order.map(|o| o.act_time),
        order.map(|o| o.position),
        created_at,
    )
    .execute(&mut **tx)
    .await?
    .rows_affected()
        == 1;
    if !inserted {
        return Ok(false);
    }
    sqlx::query!(
        "INSERT INTO comment_versions (comment_id, content, pending, created_at)
         VALUES ($1, $2, $3, $4)",
        id,
        content,
        order.is_none(),
        created_at,
    )
    .execute(&mut **tx)
    .await?;
    Ok(true)
}

/// Appends a comment version row — an edit, full merged fields.
pub async fn insert_comment_version(
    tx: &mut Transaction<'_, Postgres>,
    comment_id: Uuid,
    content: &str,
    pending: bool,
    created_at: Timestamp,
) -> Result<(), ContentError> {
    sqlx::query!(
        "INSERT INTO comment_versions (comment_id, content, pending, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (comment_id, created_at) DO NOTHING",
        comment_id,
        content,
        pending,
        created_at,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Confirm: writes the genesis record's landing coordinates onto the
/// display row, dropping its pending mark. False when no row is there to
/// land (the promotion path then inserts one). Re-running is harmless —
/// the mirror's coordinates are the same every time.
pub async fn land_post(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    order: LandingOrder,
) -> Result<bool, ContentError> {
    Ok(sqlx::query!(
        "UPDATE posts SET landed_epoch = $2, act_time = $3, position = $4
         WHERE id = $1",
        id,
        order.landed_epoch,
        order.act_time,
        order.position,
    )
    .execute(&mut **tx)
    .await?
    .rows_affected()
        == 1)
}

/// Confirm: drops the pending mark from a post's unlanded version row.
/// False when there is none — the edit landed without ever being staged
/// here, and the promotion path appends the version instead.
pub async fn land_post_version(
    tx: &mut Transaction<'_, Postgres>,
    post_id: Uuid,
) -> Result<bool, ContentError> {
    Ok(sqlx::query!(
        "UPDATE post_versions SET pending = FALSE WHERE post_id = $1 AND pending",
        post_id,
    )
    .execute(&mut **tx)
    .await?
    .rows_affected()
        >= 1)
}

/// Confirm: the comment side of [`land_post`].
pub async fn land_comment(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    order: LandingOrder,
) -> Result<bool, ContentError> {
    Ok(sqlx::query!(
        "UPDATE comments SET landed_epoch = $2, act_time = $3, position = $4
         WHERE id = $1",
        id,
        order.landed_epoch,
        order.act_time,
        order.position,
    )
    .execute(&mut **tx)
    .await?
    .rows_affected()
        == 1)
}

/// Confirm: the comment side of [`land_post_version`].
pub async fn land_comment_version(
    tx: &mut Transaction<'_, Postgres>,
    comment_id: Uuid,
) -> Result<bool, ContentError> {
    Ok(sqlx::query!(
        "UPDATE comment_versions SET pending = FALSE WHERE comment_id = $1 AND pending",
        comment_id,
    )
    .execute(&mut **tx)
    .await?
    .rows_affected()
        >= 1)
}

/// Expiry: removes whatever a never-landed write put on screen under
/// `node_id` — a pending entity row with its versions and junctions, or
/// the pending version row of an unlanded edit, which leaves the previous
/// version rendered. Landed rows are untouched; the content leaves every
/// reader's view because on the graph nothing ever existed (substrate.md
/// §6), so there is nothing to mark and no graph structure is engaged.
pub async fn discard_pending(
    tx: &mut Transaction<'_, Postgres>,
    node_id: Uuid,
) -> Result<(), ContentError> {
    sqlx::query!(
        "DELETE FROM post_versions WHERE post_id = $1 AND pending",
        node_id
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "DELETE FROM comment_versions WHERE comment_id = $1 AND pending",
        node_id
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "DELETE FROM post_attachments
         WHERE post_id = $1
           AND EXISTS (SELECT 1 FROM posts
                       WHERE id = $1 AND landed_epoch IS NULL)",
        node_id
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "DELETE FROM comment_attachments
         WHERE comment_id = $1
           AND EXISTS (SELECT 1 FROM comments
                       WHERE id = $1 AND landed_epoch IS NULL)",
        node_id
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "DELETE FROM posts WHERE id = $1 AND landed_epoch IS NULL",
        node_id
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "DELETE FROM comments WHERE id = $1 AND landed_epoch IS NULL",
        node_id
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Stores an act's payload bytes and private value — permanent carriage,
/// promoted from the staged row at confirm (layers.md §5). Idempotent on
/// the act id: a re-promotion (mirror rebuild) keeps the first row.
pub async fn insert_act_payload(
    tx: &mut Transaction<'_, Postgres>,
    act_id: &str,
    payload: &[u8],
    content_salt: &[u8],
) -> Result<(), ContentError> {
    sqlx::query!(
        "INSERT INTO act_payloads (act_id, payload, content_salt)
         VALUES ($1, $2, $3)
         ON CONFLICT (act_id) DO NOTHING",
        act_id,
        payload,
        content_salt,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The landing coordinates of a row, all-present or all-absent (the
/// table's own CHECK); a mixed row is impossible and reads as pending.
fn landing_order(
    epoch: Option<i64>,
    act_time: Option<i64>,
    position: Option<i64>,
) -> Option<LandingOrder> {
    match (epoch, act_time, position) {
        (Some(landed_epoch), Some(act_time), Some(position)) => Some(LandingOrder {
            landed_epoch,
            act_time,
            position,
        }),
        _ => None,
    }
}

fn post_from_row(row: PostRow) -> Post {
    Post {
        id: row.id,
        author_id: row.author_id,
        l1_node_id: row.l1_node_id,
        order: landing_order(row.landed_epoch, row.act_time, row.position),
        created_at: row.created_at,
        title: row.title,
        description: row.description,
        content: row.content,
        redaction_reason: row.redaction_reason,
        version_pending: row.version_pending,
        version_created_at: row.version_created_at,
    }
}

struct PostRow {
    id: Uuid,
    author_id: Uuid,
    l1_node_id: String,
    landed_epoch: Option<i64>,
    act_time: Option<i64>,
    position: Option<i64>,
    created_at: Timestamp,
    title: Option<String>,
    description: Option<String>,
    content: String,
    redaction_reason: Option<String>,
    version_pending: bool,
    version_created_at: Timestamp,
}

/// One post with its current version; None for an unknown id. Pending
/// posts resolve like any other — the content is real from the moment its
/// author signed it, for every viewer.
pub async fn post(pool: &PgPool, id: Uuid) -> Result<Option<Post>, ContentError> {
    let row = sqlx::query_as!(
        PostRow,
        r#"SELECT p.id, p.author_id, p.l1_node_id, p.landed_epoch, p.act_time,
                  p.position, p.created_at,
                  v.title, v.description,
                  v.content AS "content!", v.redaction_reason,
                  v.pending AS "version_pending!",
                  v.created_at AS "version_created_at!"
           FROM posts p
           JOIN LATERAL (
               SELECT title, description, content, redaction_reason, pending,
                      created_at
               FROM post_versions WHERE post_id = p.id
               ORDER BY created_at DESC LIMIT 1
           ) v ON TRUE
           WHERE p.id = $1"#,
        id,
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.map(post_from_row))
}

/// One post by its minted L1 node identifier — the write path's UUID →
/// node translation runs the other way through the same unique column.
pub async fn post_by_node(pool: &PgPool, l1_node_id: &str) -> Result<Option<Post>, ContentError> {
    let row = sqlx::query_as!(
        PostRow,
        r#"SELECT p.id, p.author_id, p.l1_node_id, p.landed_epoch, p.act_time,
                  p.position, p.created_at,
                  v.title, v.description,
                  v.content AS "content!", v.redaction_reason,
                  v.pending AS "version_pending!",
                  v.created_at AS "version_created_at!"
           FROM posts p
           JOIN LATERAL (
               SELECT title, description, content, redaction_reason, pending,
                      created_at
               FROM post_versions WHERE post_id = p.id
               ORDER BY created_at DESC LIMIT 1
           ) v ON TRUE
           WHERE p.l1_node_id = $1"#,
        l1_node_id,
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.map(post_from_row))
}

/// The chronological listing (roadmap "Slice 2"): global, newest-first —
/// pending entries, then landed entries in landing order (api-spec.md
/// "The record"). `cursor` is the exclusive keyset cursor in either
/// namespace; `backward` flips the walk for `last`/`before` paging
/// (results always come back newest-first). `include_pending` false
/// serves only what has landed on L1. `limit` is capped by the resolver.
pub async fn list_posts(
    pool: &PgPool,
    cursor: Option<LandingOrder>,
    backward: bool,
    limit: i64,
    include_pending: bool,
) -> Result<Vec<Post>, ContentError> {
    // The two namespaces never interleave: every pending entry sorts
    // ahead of every landed one. So a walk fills from whichever branch
    // the cursor is in and continues into the other, and each branch
    // stays a single index-served query.
    let in_pending = cursor.is_some_and(|c| c.is_pending());
    let mut out = Vec::new();
    if backward {
        if !in_pending {
            out = list_posts_landed(pool, cursor, true, limit).await?;
        }
        let remaining = limit - out.len() as i64;
        if include_pending && remaining > 0 {
            let mut pending = list_posts_pending(
                pool,
                cursor.and_then(|c| c.pending_instant()),
                true,
                remaining,
            )
            .await?;
            pending.append(&mut out);
            out = pending;
        }
    } else {
        if include_pending && (cursor.is_none() || in_pending) {
            out = list_posts_pending(pool, cursor.and_then(|c| c.pending_instant()), false, limit)
                .await?;
        }
        let remaining = limit - out.len() as i64;
        if remaining > 0 {
            let landed_cursor = cursor.filter(|c| !c.is_pending());
            out.append(&mut list_posts_landed(pool, landed_cursor, false, remaining).await?);
        }
    }
    Ok(out)
}

async fn list_posts_landed(
    pool: &PgPool,
    cursor: Option<LandingOrder>,
    backward: bool,
    limit: i64,
) -> Result<Vec<Post>, ContentError> {
    let (ce, ca, cp) = match cursor {
        Some(c) => (Some(c.landed_epoch), Some(c.act_time), Some(c.position)),
        None => (None, None, None),
    };
    let rows = sqlx::query_as!(
        PostRow,
        r#"SELECT * FROM (
               SELECT p.id, p.author_id, p.l1_node_id, p.landed_epoch,
                      p.act_time, p.position, p.created_at,
                      v.title, v.description,
                      v.content AS "content!", v.redaction_reason,
                      v.pending AS "version_pending!",
                      v.created_at AS "version_created_at!"
               FROM posts p
               JOIN LATERAL (
                   SELECT title, description, content, redaction_reason,
                          pending, created_at
                   FROM post_versions WHERE post_id = p.id
                   ORDER BY created_at DESC LIMIT 1
               ) v ON TRUE
               WHERE p.landed_epoch IS NOT NULL
                 AND ($1::bigint IS NULL
                      OR ($4 AND (p.landed_epoch, p.act_time, p.position) > ($1, $2, $3))
                      OR (NOT $4 AND (p.landed_epoch, p.act_time, p.position) < ($1, $2, $3)))
               ORDER BY
                   CASE WHEN $4 THEN p.landed_epoch END ASC,
                   CASE WHEN $4 THEN p.act_time END ASC,
                   CASE WHEN $4 THEN p.position END ASC,
                   p.landed_epoch DESC, p.act_time DESC, p.position DESC
               LIMIT $5
           ) page
           ORDER BY landed_epoch DESC, act_time DESC, position DESC"#,
        ce,
        ca,
        cp,
        backward,
        limit,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(post_from_row).collect())
}

/// The pending branch: unlanded entries newest-authored-first, keyed by
/// the authoring instant the pending cursor encodes.
async fn list_posts_pending(
    pool: &PgPool,
    cursor: Option<Timestamp>,
    backward: bool,
    limit: i64,
) -> Result<Vec<Post>, ContentError> {
    let rows = sqlx::query_as!(
        PostRow,
        r#"SELECT * FROM (
               SELECT p.id, p.author_id, p.l1_node_id, p.landed_epoch,
                      p.act_time, p.position, p.created_at,
                      v.title, v.description,
                      v.content AS "content!", v.redaction_reason,
                      v.pending AS "version_pending!",
                      v.created_at AS "version_created_at!"
               FROM posts p
               JOIN LATERAL (
                   SELECT title, description, content, redaction_reason,
                          pending, created_at
                   FROM post_versions WHERE post_id = p.id
                   ORDER BY created_at DESC LIMIT 1
               ) v ON TRUE
               WHERE p.landed_epoch IS NULL
                 AND ($1::timestamptz IS NULL
                      OR ($2 AND p.created_at > $1)
                      OR (NOT $2 AND p.created_at < $1))
               ORDER BY
                   CASE WHEN $2 THEN p.created_at END ASC,
                   p.created_at DESC
               LIMIT $3
           ) page
           ORDER BY created_at DESC"#,
        cursor,
        backward,
        limit,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(post_from_row).collect())
}

fn comment_from_row(row: CommentRow) -> Comment {
    Comment {
        id: row.id,
        target_id: row.target_id,
        target_type: row.target_type,
        author_id: row.author_id,
        l1_node_id: row.l1_node_id,
        order: landing_order(row.landed_epoch, row.act_time, row.position),
        created_at: row.created_at,
        content: row.content,
        redaction_reason: row.redaction_reason,
        version_pending: row.version_pending,
        version_created_at: row.version_created_at,
    }
}

struct CommentRow {
    id: Uuid,
    target_id: Uuid,
    target_type: String,
    author_id: Uuid,
    l1_node_id: String,
    landed_epoch: Option<i64>,
    act_time: Option<i64>,
    position: Option<i64>,
    created_at: Timestamp,
    content: String,
    redaction_reason: Option<String>,
    version_pending: bool,
    version_created_at: Timestamp,
}

/// One comment with its current version; None for an unknown id.
pub async fn comment(pool: &PgPool, id: Uuid) -> Result<Option<Comment>, ContentError> {
    let row = sqlx::query_as!(
        CommentRow,
        r#"SELECT c.id, c.target_id, c.target_type, c.author_id, c.l1_node_id,
                  c.landed_epoch, c.act_time, c.position, c.created_at,
                  v.content AS "content!", v.redaction_reason,
                  v.pending AS "version_pending!",
                  v.created_at AS "version_created_at!"
           FROM comments c
           JOIN LATERAL (
               SELECT content, redaction_reason, pending, created_at
               FROM comment_versions WHERE comment_id = c.id
               ORDER BY created_at DESC LIMIT 1
           ) v ON TRUE
           WHERE c.id = $1"#,
        id,
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.map(comment_from_row))
}

/// One comment by its minted L1 node identifier.
pub async fn comment_by_node(
    pool: &PgPool,
    l1_node_id: &str,
) -> Result<Option<Comment>, ContentError> {
    let row = sqlx::query_as!(
        CommentRow,
        r#"SELECT c.id, c.target_id, c.target_type, c.author_id, c.l1_node_id,
                  c.landed_epoch, c.act_time, c.position, c.created_at,
                  v.content AS "content!", v.redaction_reason,
                  v.pending AS "version_pending!",
                  v.created_at AS "version_created_at!"
           FROM comments c
           JOIN LATERAL (
               SELECT content, redaction_reason, pending, created_at
               FROM comment_versions WHERE comment_id = c.id
               ORDER BY created_at DESC LIMIT 1
           ) v ON TRUE
           WHERE c.l1_node_id = $1"#,
        l1_node_id,
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.map(comment_from_row))
}

/// A target's comments — the thread read (comment.md §2): direct
/// children only, newest-first — pending entries, then landed entries in
/// landing order (a comment's landing position is its genesis, so edits
/// never reorder the thread — api-spec.md "Pagination"). `backward`
/// serves `last`/`before`; results always come back newest-first.
pub async fn comments_for_target(
    pool: &PgPool,
    target_id: Uuid,
    cursor: Option<LandingOrder>,
    backward: bool,
    limit: i64,
    include_pending: bool,
) -> Result<Vec<Comment>, ContentError> {
    let in_pending = cursor.is_some_and(|c| c.is_pending());
    let mut out = Vec::new();
    if backward {
        if !in_pending {
            out = comments_landed(pool, target_id, cursor, true, limit).await?;
        }
        let remaining = limit - out.len() as i64;
        if include_pending && remaining > 0 {
            let mut pending = comments_pending(
                pool,
                target_id,
                cursor.and_then(|c| c.pending_instant()),
                true,
                remaining,
            )
            .await?;
            pending.append(&mut out);
            out = pending;
        }
    } else {
        if include_pending && (cursor.is_none() || in_pending) {
            out = comments_pending(
                pool,
                target_id,
                cursor.and_then(|c| c.pending_instant()),
                false,
                limit,
            )
            .await?;
        }
        let remaining = limit - out.len() as i64;
        if remaining > 0 {
            let landed_cursor = cursor.filter(|c| !c.is_pending());
            out.append(
                &mut comments_landed(pool, target_id, landed_cursor, false, remaining).await?,
            );
        }
    }
    Ok(out)
}

async fn comments_landed(
    pool: &PgPool,
    target_id: Uuid,
    cursor: Option<LandingOrder>,
    backward: bool,
    limit: i64,
) -> Result<Vec<Comment>, ContentError> {
    let (ce, ca, cp) = match cursor {
        Some(c) => (Some(c.landed_epoch), Some(c.act_time), Some(c.position)),
        None => (None, None, None),
    };
    let rows = sqlx::query_as!(
        CommentRow,
        r#"SELECT * FROM (
               SELECT c.id, c.target_id, c.target_type, c.author_id,
                      c.l1_node_id, c.landed_epoch, c.act_time, c.position,
                      c.created_at,
                      v.content AS "content!", v.redaction_reason,
                      v.pending AS "version_pending!",
                      v.created_at AS "version_created_at!"
               FROM comments c
               JOIN LATERAL (
                   SELECT content, redaction_reason, pending, created_at
                   FROM comment_versions WHERE comment_id = c.id
                   ORDER BY created_at DESC LIMIT 1
               ) v ON TRUE
               WHERE c.target_id = $6
                 AND c.landed_epoch IS NOT NULL
                 AND ($1::bigint IS NULL
                      OR ($4 AND (c.landed_epoch, c.act_time, c.position) > ($1, $2, $3))
                      OR (NOT $4 AND (c.landed_epoch, c.act_time, c.position) < ($1, $2, $3)))
               ORDER BY
                   CASE WHEN $4 THEN c.landed_epoch END ASC,
                   CASE WHEN $4 THEN c.act_time END ASC,
                   CASE WHEN $4 THEN c.position END ASC,
                   c.landed_epoch DESC, c.act_time DESC, c.position DESC
               LIMIT $5
           ) page
           ORDER BY landed_epoch DESC, act_time DESC, position DESC"#,
        ce,
        ca,
        cp,
        backward,
        limit,
        target_id,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(comment_from_row).collect())
}

async fn comments_pending(
    pool: &PgPool,
    target_id: Uuid,
    cursor: Option<Timestamp>,
    backward: bool,
    limit: i64,
) -> Result<Vec<Comment>, ContentError> {
    let rows = sqlx::query_as!(
        CommentRow,
        r#"SELECT * FROM (
               SELECT c.id, c.target_id, c.target_type, c.author_id,
                      c.l1_node_id, c.landed_epoch, c.act_time, c.position,
                      c.created_at,
                      v.content AS "content!", v.redaction_reason,
                      v.pending AS "version_pending!",
                      v.created_at AS "version_created_at!"
               FROM comments c
               JOIN LATERAL (
                   SELECT content, redaction_reason, pending, created_at
                   FROM comment_versions WHERE comment_id = c.id
                   ORDER BY created_at DESC LIMIT 1
               ) v ON TRUE
               WHERE c.target_id = $4
                 AND c.landed_epoch IS NULL
                 AND ($1::timestamptz IS NULL
                      OR ($2 AND c.created_at > $1)
                      OR (NOT $2 AND c.created_at < $1))
               ORDER BY
                   CASE WHEN $2 THEN c.created_at END ASC,
                   c.created_at DESC
               LIMIT $3
           ) page
           ORDER BY created_at DESC"#,
        cursor,
        backward,
        limit,
        target_id,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(comment_from_row).collect())
}

/// Which content kind a UUID names — the `node(id)` dispatch. The
/// entity tables are the registry, pending rows included; a UUID in
/// neither is not a content node (actors resolve through their own
/// table).
pub async fn content_kind(pool: &PgPool, id: Uuid) -> Result<Option<&'static str>, ContentError> {
    if sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM posts WHERE id = $1) AS "e!""#,
        id
    )
    .fetch_one(pool)
    .await?
    {
        return Ok(Some("post"));
    }
    if sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM comments WHERE id = $1) AS "e!""#,
        id
    )
    .fetch_one(pool)
    .await?
    {
        return Ok(Some("comment"));
    }
    Ok(None)
}
