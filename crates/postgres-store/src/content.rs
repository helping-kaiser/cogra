// Display content for the content slice (data-model.md "Content nodes",
// "Display-content versioning"): immutable entity rows bound to their
// minted L1 node, append-only version rows, and the act payload carriage.
// Every entity row is written at confirm — promotion from a landed staged
// write — never at prepare (architecture.md "The write path" step 5).
// The landing-order columns cache the genesis record's authoritative
// causal key; like every mirror-derived column they are rebuildable and
// never authoritative (data-model.md "The Boundary Rule").

use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

#[derive(Debug, thiserror::Error)]
pub enum ContentError {
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
}

/// The genesis record's landing coordinates — the listing sort key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct LandingOrder {
    pub landed_epoch: i64,
    pub act_time: i64,
    pub position: i64,
}

/// One post with its current display version (entity row + newest
/// version row).
#[derive(Debug, Clone)]
pub struct Post {
    pub id: Uuid,
    pub author_id: Uuid,
    pub l1_node_id: String,
    pub order: LandingOrder,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub content: String,
    pub redaction_reason: Option<String>,
    /// The current version row's timestamp — `updatedAt` when it differs
    /// from `created_at` (data-model.md: updated_at is derived, never
    /// stored).
    pub version_created_at: chrono::DateTime<chrono::Utc>,
}

/// One comment with its current display version.
#[derive(Debug, Clone)]
pub struct Comment {
    pub id: Uuid,
    pub target_id: Uuid,
    pub target_type: String,
    pub author_id: Uuid,
    pub l1_node_id: String,
    pub order: LandingOrder,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub content: String,
    pub redaction_reason: Option<String>,
    pub version_created_at: chrono::DateTime<chrono::Utc>,
}

/// Inserts a post's entity row and its first version row — genesis
/// promotion, one transaction with the carriage row.
#[allow(clippy::too_many_arguments)]
pub async fn insert_post(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    author_id: Uuid,
    l1_node_id: &str,
    order: LandingOrder,
    title: Option<&str>,
    description: Option<&str>,
    content: &str,
) -> Result<(), ContentError> {
    sqlx::query!(
        "INSERT INTO posts (id, author_id, l1_node_id, landed_epoch, act_time, position)
         VALUES ($1, $2, $3, $4, $5, $6)",
        id,
        author_id,
        l1_node_id,
        order.landed_epoch,
        order.act_time,
        order.position,
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "INSERT INTO post_versions (post_id, title, description, content)
         VALUES ($1, $2, $3, $4)",
        id,
        title,
        description,
        content,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Appends a post version row — edit promotion. The caller supplies the
/// full merged field set (an edit's unchanged fields are copied forward
/// so the newest row alone renders the post — data-model.md
/// "Display-content versioning").
pub async fn insert_post_version(
    tx: &mut Transaction<'_, Postgres>,
    post_id: Uuid,
    title: Option<&str>,
    description: Option<&str>,
    content: &str,
) -> Result<(), ContentError> {
    sqlx::query!(
        "INSERT INTO post_versions (post_id, title, description, content)
         VALUES ($1, $2, $3, $4)",
        post_id,
        title,
        description,
        content,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Inserts a comment's entity row and its first version row.
#[allow(clippy::too_many_arguments)]
pub async fn insert_comment(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    target_id: Uuid,
    target_type: &str,
    author_id: Uuid,
    l1_node_id: &str,
    order: LandingOrder,
    content: &str,
) -> Result<(), ContentError> {
    sqlx::query!(
        "INSERT INTO comments
             (id, target_id, target_type, author_id, l1_node_id,
              landed_epoch, act_time, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        id,
        target_id,
        target_type,
        author_id,
        l1_node_id,
        order.landed_epoch,
        order.act_time,
        order.position,
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "INSERT INTO comment_versions (comment_id, content) VALUES ($1, $2)",
        id,
        content,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Appends a comment version row — edit promotion, full merged fields.
pub async fn insert_comment_version(
    tx: &mut Transaction<'_, Postgres>,
    comment_id: Uuid,
    content: &str,
) -> Result<(), ContentError> {
    sqlx::query!(
        "INSERT INTO comment_versions (comment_id, content) VALUES ($1, $2)",
        comment_id,
        content,
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

fn post_from_row(row: PostRow) -> Post {
    Post {
        id: row.id,
        author_id: row.author_id,
        l1_node_id: row.l1_node_id,
        order: LandingOrder {
            landed_epoch: row.landed_epoch,
            act_time: row.act_time,
            position: row.position,
        },
        created_at: row.created_at,
        title: row.title,
        description: row.description,
        content: row.content,
        redaction_reason: row.redaction_reason,
        version_created_at: row.version_created_at,
    }
}

struct PostRow {
    id: Uuid,
    author_id: Uuid,
    l1_node_id: String,
    landed_epoch: i64,
    act_time: i64,
    position: i64,
    created_at: chrono::DateTime<chrono::Utc>,
    title: Option<String>,
    description: Option<String>,
    content: String,
    redaction_reason: Option<String>,
    version_created_at: chrono::DateTime<chrono::Utc>,
}

/// One post with its current version; None for an unknown id.
pub async fn post(pool: &PgPool, id: Uuid) -> Result<Option<Post>, ContentError> {
    let row = sqlx::query_as!(
        PostRow,
        r#"SELECT p.id, p.author_id, p.l1_node_id, p.landed_epoch, p.act_time,
                  p.position, p.created_at,
                  v.title, v.description,
                  v.content AS "content!", v.redaction_reason,
                  v.created_at AS "version_created_at!"
           FROM posts p
           JOIN LATERAL (
               SELECT title, description, content, redaction_reason, created_at
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
                  v.created_at AS "version_created_at!"
           FROM posts p
           JOIN LATERAL (
               SELECT title, description, content, redaction_reason, created_at
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

/// The chronological listing (roadmap "Slice 2"): global, newest-first in
/// landing order. `after` is the exclusive keyset cursor; `backward`
/// flips the walk for `last`/`before` paging (results always come back
/// newest-first). `limit` is capped by the resolver.
pub async fn list_posts(
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
                      v.created_at AS "version_created_at!"
               FROM posts p
               JOIN LATERAL (
                   SELECT title, description, content, redaction_reason, created_at
                   FROM post_versions WHERE post_id = p.id
                   ORDER BY created_at DESC LIMIT 1
               ) v ON TRUE
               WHERE ($1::bigint IS NULL
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

fn comment_from_row(row: CommentRow) -> Comment {
    Comment {
        id: row.id,
        target_id: row.target_id,
        target_type: row.target_type,
        author_id: row.author_id,
        l1_node_id: row.l1_node_id,
        order: LandingOrder {
            landed_epoch: row.landed_epoch,
            act_time: row.act_time,
            position: row.position,
        },
        created_at: row.created_at,
        content: row.content,
        redaction_reason: row.redaction_reason,
        version_created_at: row.version_created_at,
    }
}

struct CommentRow {
    id: Uuid,
    target_id: Uuid,
    target_type: String,
    author_id: Uuid,
    l1_node_id: String,
    landed_epoch: i64,
    act_time: i64,
    position: i64,
    created_at: chrono::DateTime<chrono::Utc>,
    content: String,
    redaction_reason: Option<String>,
    version_created_at: chrono::DateTime<chrono::Utc>,
}

/// One comment with its current version; None for an unknown id.
pub async fn comment(pool: &PgPool, id: Uuid) -> Result<Option<Comment>, ContentError> {
    let row = sqlx::query_as!(
        CommentRow,
        r#"SELECT c.id, c.target_id, c.target_type, c.author_id, c.l1_node_id,
                  c.landed_epoch, c.act_time, c.position, c.created_at,
                  v.content AS "content!", v.redaction_reason,
                  v.created_at AS "version_created_at!"
           FROM comments c
           JOIN LATERAL (
               SELECT content, redaction_reason, created_at
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
                  v.created_at AS "version_created_at!"
           FROM comments c
           JOIN LATERAL (
               SELECT content, redaction_reason, created_at
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
/// children only, oldest-first in landing order (conversation order).
/// `backward` serves `last`/`before`; results always come back
/// oldest-first.
pub async fn comments_for_target(
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
                      v.created_at AS "version_created_at!"
               FROM comments c
               JOIN LATERAL (
                   SELECT content, redaction_reason, created_at
                   FROM comment_versions WHERE comment_id = c.id
                   ORDER BY created_at DESC LIMIT 1
               ) v ON TRUE
               WHERE c.target_id = $6
                 AND ($1::bigint IS NULL
                      OR ($4 AND (c.landed_epoch, c.act_time, c.position) < ($1, $2, $3))
                      OR (NOT $4 AND (c.landed_epoch, c.act_time, c.position) > ($1, $2, $3)))
               ORDER BY
                   CASE WHEN $4 THEN c.landed_epoch END DESC,
                   CASE WHEN $4 THEN c.act_time END DESC,
                   CASE WHEN $4 THEN c.position END DESC,
                   c.landed_epoch ASC, c.act_time ASC, c.position ASC
               LIMIT $5
           ) page
           ORDER BY landed_epoch ASC, act_time ASC, position ASC"#,
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

/// Which content kind a UUID names — the `node(id)` dispatch. The
/// entity tables are the registry; a UUID in neither is not a content
/// node (actors resolve through their own table).
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
