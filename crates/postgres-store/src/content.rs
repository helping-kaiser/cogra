//! ´mod:module:content´
//!
//! Display content for the content slice: immutable entity rows bound to
//! their minted L1 node, append-only version rows, and the act payload
//! carriage (data-model.md "Content nodes", "Display-content versioning").
//!
//! An entity row is written at the pre-commitment signature and carries a
//! pending mark — absent landing coordinates — until confirm fills them
//! in; a prepared record is its author's content from the moment they sign
//! it (substrate.md §6).
//!
//! Version rows carry the coordinates of the record that promoted them,
//! and those order a node's versions: the newest version is the one whose
//! record landed last, not the one whose row was written last. Like every
//! mirror-derived column they are rebuildable and never authoritative
//! (data-model.md "The Boundary Rule").

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

/// A listing cursor: the sort key, plus the entry's own id.
///
/// The id carries two things the key alone cannot. A pending key is the
/// authoring instant, which two writes can share — nothing serializes
/// two authors' pre-commitment signatures apart — so the id is the
/// tiebreaker that keeps a page boundary from dropping siblings. And a
/// pending entry can *land* between two pages, moving from one namespace
/// to the other; the id is what lets the walk find where it went instead
/// of serving it a second time out of the landed branch.
///
/// `id` is optional so a cursor issued before it was carried still
/// paginates, on the key alone.
#[derive(Debug, Clone, Copy)]
pub struct ContentCursor {
    pub order: LandingOrder,
    pub id: Option<Uuid>,
}

/// One post with its current display version (entity row + newest
/// version row).
#[derive(Debug, Clone)]
pub struct Post {
    pub id: Uuid,
    pub author_id: Uuid,
    pub l1_node_id: String,
    /// The canonical license string the genesis record published — a
    /// structural field of that record, cached here for the read side
    /// (platform-guidelines.md §5).
    pub license: String,
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
    /// The canonical license string the genesis record published.
    pub license: String,
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
    license: &str,
    order: Option<LandingOrder>,
    created_at: Timestamp,
    title: Option<&str>,
    description: Option<&str>,
    content: &str,
) -> Result<bool, ContentError> {
    let inserted = sqlx::query!(
        "INSERT INTO posts
             (id, author_id, l1_node_id, license, landed_epoch, act_time,
              position, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING",
        id,
        author_id,
        l1_node_id,
        license,
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
             (post_id, title, description, content, pending, created_at,
              landed_epoch, act_time, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        id,
        title,
        description,
        content,
        order.is_none(),
        created_at,
        order.map(|o| o.landed_epoch),
        order.map(|o| o.act_time),
        order.map(|o| o.position),
    )
    .execute(&mut **tx)
    .await?;
    Ok(true)
}

/// Appends a post version row — an edit. The caller supplies the full
/// merged field set (an edit's unchanged fields are copied forward so the
/// newest row alone renders the post — data-model.md "Display-content
/// versioning"). `order` is None at the pre-commitment — the version is
/// pending — and Some for an edit promoted without one.
#[allow(clippy::too_many_arguments)]
pub async fn insert_post_version(
    tx: &mut Transaction<'_, Postgres>,
    post_id: Uuid,
    title: Option<&str>,
    description: Option<&str>,
    content: &str,
    order: Option<LandingOrder>,
    created_at: Timestamp,
) -> Result<(), ContentError> {
    sqlx::query!(
        "INSERT INTO post_versions
             (post_id, title, description, content, pending, created_at,
              landed_epoch, act_time, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (post_id, created_at) DO NOTHING",
        post_id,
        title,
        description,
        content,
        order.is_none(),
        created_at,
        order.map(|o| o.landed_epoch),
        order.map(|o| o.act_time),
        order.map(|o| o.position),
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
    license: &str,
    order: Option<LandingOrder>,
    created_at: Timestamp,
    content: &str,
) -> Result<bool, ContentError> {
    let inserted = sqlx::query!(
        "INSERT INTO comments
             (id, target_id, target_type, author_id, l1_node_id, license,
              landed_epoch, act_time, position, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING",
        id,
        target_id,
        target_type,
        author_id,
        l1_node_id,
        license,
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
        "INSERT INTO comment_versions
             (comment_id, content, pending, created_at,
              landed_epoch, act_time, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
        id,
        content,
        order.is_none(),
        created_at,
        order.map(|o| o.landed_epoch),
        order.map(|o| o.act_time),
        order.map(|o| o.position),
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
    order: Option<LandingOrder>,
    created_at: Timestamp,
) -> Result<(), ContentError> {
    sqlx::query!(
        "INSERT INTO comment_versions
             (comment_id, content, pending, created_at,
              landed_epoch, act_time, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (comment_id, created_at) DO NOTHING",
        comment_id,
        content,
        order.is_none(),
        created_at,
        order.map(|o| o.landed_epoch),
        order.map(|o| o.act_time),
        order.map(|o| o.position),
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

/// Confirm: writes the edit record's landing coordinates onto the version
/// row the landing write itself staged and drops its pending mark. The
/// row is named by its authoring instant — `(post_id, created_at)` is
/// unique, so a node carrying more than one unlanded version never lands
/// a write's text on another's record. False when there is none — the
/// edit landed without ever being staged here, and the promotion path
/// appends the version instead.
pub async fn land_post_version(
    tx: &mut Transaction<'_, Postgres>,
    post_id: Uuid,
    created_at: Timestamp,
    order: LandingOrder,
) -> Result<bool, ContentError> {
    Ok(sqlx::query!(
        "UPDATE post_versions
            SET pending = FALSE, landed_epoch = $3, act_time = $4,
                position = $5
         WHERE post_id = $1 AND created_at = $2 AND pending",
        post_id,
        created_at,
        order.landed_epoch,
        order.act_time,
        order.position,
    )
    .execute(&mut **tx)
    .await?
    .rows_affected()
        == 1)
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
    created_at: Timestamp,
    order: LandingOrder,
) -> Result<bool, ContentError> {
    Ok(sqlx::query!(
        "UPDATE comment_versions
            SET pending = FALSE, landed_epoch = $3, act_time = $4,
                position = $5
         WHERE comment_id = $1 AND created_at = $2 AND pending",
        comment_id,
        created_at,
        order.landed_epoch,
        order.act_time,
        order.position,
    )
    .execute(&mut **tx)
    .await?
    .rows_affected()
        == 1)
}

/// Expiry: removes whatever a never-landed write put on screen under
/// `node_id` — a pending entity row with its versions and junctions, or
/// the pending version row of an unlanded edit, which leaves the previous
/// version rendered. `created_at` is the write's own authoring instant,
/// and every statement is scoped to it: a node can carry the pending rows
/// of more than one staged write, and expiring one must not take
/// another's. Landed rows are untouched; the content leaves every
/// reader's view because on the graph nothing ever existed (substrate.md
/// §6), so there is nothing to mark and no graph structure is engaged.
pub async fn discard_pending(
    tx: &mut Transaction<'_, Postgres>,
    node_id: Uuid,
    created_at: Timestamp,
) -> Result<(), ContentError> {
    discard_pending_many(tx, &[node_id], &[created_at]).await
}

/// The same discard for many writes at once — a GC sweep is a fixed
/// handful of statements rather than six per node. `nodes` and
/// `instants` are parallel: each index is one write's node and the
/// authoring instant its rows carry, and the pair is what every
/// statement matches on.
pub async fn discard_pending_many(
    tx: &mut Transaction<'_, Postgres>,
    nodes: &[Uuid],
    instants: &[Timestamp],
) -> Result<(), ContentError> {
    if nodes.is_empty() {
        return Ok(());
    }
    sqlx::query!(
        "DELETE FROM post_versions
         WHERE (post_id, created_at)
               IN (SELECT * FROM unnest($1::uuid[], $2::timestamptz[]))
           AND pending",
        nodes,
        instants,
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "DELETE FROM comment_versions
         WHERE (comment_id, created_at)
               IN (SELECT * FROM unnest($1::uuid[], $2::timestamptz[]))
           AND pending",
        nodes,
        instants,
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "DELETE FROM post_attachments
         WHERE post_id IN (
             SELECT id FROM posts
             WHERE (id, created_at)
                   IN (SELECT * FROM unnest($1::uuid[], $2::timestamptz[]))
               AND landed_epoch IS NULL)",
        nodes,
        instants,
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "DELETE FROM comment_attachments
         WHERE comment_id IN (
             SELECT id FROM comments
             WHERE (id, created_at)
                   IN (SELECT * FROM unnest($1::uuid[], $2::timestamptz[]))
               AND landed_epoch IS NULL)",
        nodes,
        instants,
    )
    .execute(&mut **tx)
    .await?;
    let mut removed = sqlx::query_scalar!(
        "DELETE FROM posts
         WHERE (id, created_at)
               IN (SELECT * FROM unnest($1::uuid[], $2::timestamptz[]))
           AND landed_epoch IS NULL
         RETURNING id",
        nodes,
        instants,
    )
    .fetch_all(&mut **tx)
    .await?;
    removed.extend(
        sqlx::query_scalar!(
            "DELETE FROM comments
             WHERE (id, created_at)
                   IN (SELECT * FROM unnest($1::uuid[], $2::timestamptz[]))
               AND landed_epoch IS NULL
             RETURNING id",
            nodes,
            instants,
        )
        .fetch_all(&mut **tx)
        .await?,
    );
    discard_pending_thread(tx, removed).await?;
    Ok(())
}

/// Expiry's transitive reach: a discarded pending node takes the pending
/// comments hanging under it, and the pending replies under those. Their
/// own staged writes expire on their own schedule, but the content has
/// nowhere left to hang — a pending comment on nothing is not a thread.
/// Each one goes whole, versions and attachments with it, since a pending
/// node's versions are all pending by construction. A *landed* comment is
/// left where it is: its record is ordered fact, so it renders as an
/// orphan whose `target` resolves to null.
async fn discard_pending_thread(
    tx: &mut Transaction<'_, Postgres>,
    roots: Vec<Uuid>,
) -> Result<(), ContentError> {
    let mut frontier = roots;
    while !frontier.is_empty() {
        let children: Vec<Uuid> = sqlx::query_scalar!(
            "SELECT id FROM comments
             WHERE target_id = ANY($1) AND landed_epoch IS NULL",
            &frontier,
        )
        .fetch_all(&mut **tx)
        .await?;
        if children.is_empty() {
            break;
        }
        sqlx::query!(
            "DELETE FROM comment_versions WHERE comment_id = ANY($1)",
            &children
        )
        .execute(&mut **tx)
        .await?;
        sqlx::query!(
            "DELETE FROM comment_attachments WHERE comment_id = ANY($1)",
            &children
        )
        .execute(&mut **tx)
        .await?;
        sqlx::query!("DELETE FROM comments WHERE id = ANY($1)", &children)
            .execute(&mut **tx)
            .await?;
        frontier = children;
    }
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
        license: row.license,
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
    license: String,
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
        r#"SELECT p.id, p.author_id, p.l1_node_id, p.license,
                  p.landed_epoch, p.act_time, p.position, p.created_at,
                  v.title, v.description,
                  v.content AS "content!", v.redaction_reason,
                  v.pending AS "version_pending!",
                  v.created_at AS "version_created_at!"
           FROM posts p
           JOIN LATERAL (
               SELECT title, description, content, redaction_reason, pending,
                      created_at
               FROM post_versions WHERE post_id = p.id
               ORDER BY pending DESC,
                        landed_epoch DESC NULLS LAST,
                        act_time DESC NULLS LAST,
                        position DESC NULLS LAST,
                        created_at DESC, version_id DESC
               LIMIT 1
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
        r#"SELECT p.id, p.author_id, p.l1_node_id, p.license,
                  p.landed_epoch, p.act_time, p.position, p.created_at,
                  v.title, v.description,
                  v.content AS "content!", v.redaction_reason,
                  v.pending AS "version_pending!",
                  v.created_at AS "version_created_at!"
           FROM posts p
           JOIN LATERAL (
               SELECT title, description, content, redaction_reason, pending,
                      created_at
               FROM post_versions WHERE post_id = p.id
               ORDER BY pending DESC,
                        landed_epoch DESC NULLS LAST,
                        act_time DESC NULLS LAST,
                        position DESC NULLS LAST,
                        created_at DESC, version_id DESC
               LIMIT 1
           ) v ON TRUE
           WHERE p.l1_node_id = $1"#,
        l1_node_id,
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.map(post_from_row))
}

/// Every post among `l1_node_ids`, in one round trip — the batched twin
/// of [`post_by_node`], for a read holding many identifiers at once. An
/// identifier no post answers to is simply absent from the result.
pub async fn posts_by_nodes(
    pool: &PgPool,
    l1_node_ids: &[String],
) -> Result<Vec<Post>, ContentError> {
    let rows = sqlx::query_as!(
        PostRow,
        r#"SELECT p.id, p.author_id, p.l1_node_id, p.license,
                  p.landed_epoch, p.act_time, p.position, p.created_at,
                  v.title, v.description,
                  v.content AS "content!", v.redaction_reason,
                  v.pending AS "version_pending!",
                  v.created_at AS "version_created_at!"
           FROM posts p
           JOIN LATERAL (
               SELECT title, description, content, redaction_reason, pending,
                      created_at
               FROM post_versions WHERE post_id = p.id
               ORDER BY pending DESC,
                        landed_epoch DESC NULLS LAST,
                        act_time DESC NULLS LAST,
                        position DESC NULLS LAST,
                        created_at DESC, version_id DESC
               LIMIT 1
           ) v ON TRUE
           WHERE p.l1_node_id = ANY($1)"#,
        l1_node_ids,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(post_from_row).collect())
}

/// The chronological listing (roadmap "Slice 2"): global, newest-first —
/// pending entries, then landed entries in landing order (api-spec.md
/// "The record"). `cursor` is the exclusive keyset cursor in either
/// namespace; `backward` flips the walk for `last`/`before` paging
/// (results always come back newest-first). `include_pending` false
/// serves only what has landed on L1. `limit` is capped by the resolver.
/// The cursor is re-resolved against its entry's current state before the
/// walk, so an entry that lands between two pages is not served a second
/// time out of the other namespace.
pub async fn list_posts(
    pool: &PgPool,
    cursor: Option<ContentCursor>,
    backward: bool,
    limit: i64,
    include_pending: bool,
) -> Result<Vec<Post>, ContentError> {
    let cursor = resolve_post_cursor(pool, cursor).await?;
    merge_walk(
        cursor,
        backward,
        limit,
        include_pending,
        |c, back, n| list_posts_landed(pool, c, back, n, include_pending),
        |c, back, n| list_posts_pending(pool, c, back, n),
    )
    .await
}

/// The two-branch walk both listings share. The namespaces never
/// interleave — every pending entry sorts ahead of every landed one — so
/// the walk fills from whichever branch the cursor sits in and continues
/// into the other, and each branch stays a single index-served query.
/// Results always come back newest-first, whichever way the walk ran.
async fn merge_walk<T, Landed, Pending, LFut, PFut>(
    cursor: Option<ContentCursor>,
    backward: bool,
    limit: i64,
    include_pending: bool,
    landed: Landed,
    pending: Pending,
) -> Result<Vec<T>, ContentError>
where
    Landed: Fn(Option<LandingOrder>, bool, i64) -> LFut,
    Pending: Fn((Option<Timestamp>, Option<Uuid>), bool, i64) -> PFut,
    LFut: std::future::Future<Output = Result<Vec<T>, ContentError>>,
    PFut: std::future::Future<Output = Result<Vec<T>, ContentError>>,
{
    let in_pending = cursor.is_some_and(|c| c.order.is_pending());
    let mut out = Vec::new();
    if backward {
        if !in_pending {
            out = landed(cursor.map(|c| c.order), true, limit).await?;
        }
        let remaining = limit - out.len() as i64;
        if include_pending && remaining > 0 {
            let mut head = pending(pending_from(cursor), true, remaining).await?;
            head.append(&mut out);
            out = head;
        }
    } else {
        if include_pending && (cursor.is_none() || in_pending) {
            out = pending(pending_from(cursor), false, limit).await?;
        }
        let remaining = limit - out.len() as i64;
        if remaining > 0 {
            let landed_cursor = cursor.map(|c| c.order).filter(|o| !o.is_pending());
            out.append(&mut landed(landed_cursor, false, remaining).await?);
        }
    }
    Ok(out)
}

/// The pending branch's keyset: the authoring instant and the entry id
/// that breaks ties on it. Empty for a cursor in the landed namespace —
/// the pending branch is then walked from its own end.
fn pending_from(cursor: Option<ContentCursor>) -> (Option<Timestamp>, Option<Uuid>) {
    match cursor.filter(|c| c.order.is_pending()) {
        Some(c) => (c.order.pending_instant(), c.id),
        None => (None, None),
    }
}

/// The id a pending cursor must be re-checked against, if any: only a
/// pending cursor can move, and only one carrying an id can be found.
fn movable(cursor: Option<ContentCursor>) -> Option<Uuid> {
    cursor.filter(|c| c.order.is_pending()).and_then(|c| c.id)
}

/// Re-points a cursor at the landing coordinates its entry has now.
/// `None` means the entry is still pending, so the cursor stands.
fn repoint(cursor: Option<ContentCursor>, landed: Option<LandingOrder>) -> Option<ContentCursor> {
    match (cursor, landed) {
        (Some(c), Some(order)) => Some(ContentCursor { order, ..c }),
        (c, _) => c,
    }
}

/// Where a post cursor's entry sits *now*. A pending cursor names an
/// entry whose key moves when it lands, so a walk resuming from it has
/// to ask the row, not the cursor. A landed cursor never moves — a
/// node's landing position is its genesis — and is returned unchanged,
/// as is a cursor carrying no id to look up.
async fn resolve_post_cursor(
    pool: &PgPool,
    cursor: Option<ContentCursor>,
) -> Result<Option<ContentCursor>, ContentError> {
    let Some(id) = movable(cursor) else {
        return Ok(cursor);
    };
    let landed = sqlx::query!(
        "SELECT landed_epoch, act_time, position FROM posts WHERE id = $1",
        id
    )
    .fetch_optional(pool)
    .await?
    .and_then(|r| landing_order(r.landed_epoch, r.act_time, r.position));
    Ok(repoint(cursor, landed))
}

/// The comment side of [`resolve_post_cursor`].
async fn resolve_comment_cursor(
    pool: &PgPool,
    cursor: Option<ContentCursor>,
) -> Result<Option<ContentCursor>, ContentError> {
    let Some(id) = movable(cursor) else {
        return Ok(cursor);
    };
    let landed = sqlx::query!(
        "SELECT landed_epoch, act_time, position FROM comments WHERE id = $1",
        id
    )
    .fetch_optional(pool)
    .await?
    .and_then(|r| landing_order(r.landed_epoch, r.act_time, r.position));
    Ok(repoint(cursor, landed))
}

/// The landed branch. `include_pending` reaches the version lateral as
/// well as the entity filter: a landed node carrying an unlanded edit
/// renders that edit's text by default (D4), so a reader who asked for
/// the settled graph must be served the version that landed instead.
/// The pre-edit version is always there — an edit appends a row, it
/// never replaces one — so the node is served either way, and it reads
/// LANDED with its epoch because the text on screen is ordered fact.
async fn list_posts_landed(
    pool: &PgPool,
    cursor: Option<LandingOrder>,
    backward: bool,
    limit: i64,
    include_pending: bool,
) -> Result<Vec<Post>, ContentError> {
    let (ce, ca, cp) = match cursor {
        Some(c) => (Some(c.landed_epoch), Some(c.act_time), Some(c.position)),
        None => (None, None, None),
    };
    let rows = sqlx::query_as!(
        PostRow,
        r#"SELECT * FROM (
               SELECT p.id, p.author_id, p.l1_node_id, p.license,
                      p.landed_epoch, p.act_time, p.position, p.created_at,
                      v.title, v.description,
                      v.content AS "content!", v.redaction_reason,
                      v.pending AS "version_pending!",
                      v.created_at AS "version_created_at!"
               FROM posts p
               JOIN LATERAL (
                   SELECT title, description, content, redaction_reason,
                          pending, created_at
                   FROM post_versions
                   WHERE post_id = p.id AND ($6 OR NOT pending)
                   ORDER BY pending DESC,
                            landed_epoch DESC NULLS LAST,
                            act_time DESC NULLS LAST,
                            position DESC NULLS LAST,
                            created_at DESC, version_id DESC
                   LIMIT 1
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
        include_pending,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(post_from_row).collect())
}

/// The pending branch: unlanded entries newest-authored-first, keyed by
/// `(authoring instant, id)`. The id is in the key because the instant
/// alone is not unique — two authors' pre-commitment signatures can share
/// a microsecond, and a keyset on a non-unique column drops the siblings
/// at every page boundary. A cursor from before the id was carried
/// (`None`) keysets on the instant alone.
async fn list_posts_pending(
    pool: &PgPool,
    cursor: (Option<Timestamp>, Option<Uuid>),
    backward: bool,
    limit: i64,
) -> Result<Vec<Post>, ContentError> {
    let (at, after_id) = cursor;
    let rows = sqlx::query_as!(
        PostRow,
        r#"SELECT * FROM (
               SELECT p.id, p.author_id, p.l1_node_id, p.license,
                      p.landed_epoch, p.act_time, p.position, p.created_at,
                      v.title, v.description,
                      v.content AS "content!", v.redaction_reason,
                      v.pending AS "version_pending!",
                      v.created_at AS "version_created_at!"
               FROM posts p
               JOIN LATERAL (
                   SELECT title, description, content, redaction_reason,
                          pending, created_at
                   FROM post_versions WHERE post_id = p.id
                   ORDER BY pending DESC,
                            landed_epoch DESC NULLS LAST,
                            act_time DESC NULLS LAST,
                            position DESC NULLS LAST,
                            created_at DESC, version_id DESC
                   LIMIT 1
               ) v ON TRUE
               WHERE p.landed_epoch IS NULL
                 AND ($1::timestamptz IS NULL
                      OR ($3 AND (($2::uuid IS NULL AND p.created_at > $1)
                                  OR ($2 IS NOT NULL
                                      AND (p.created_at, p.id) > ($1, $2))))
                      OR (NOT $3 AND (($2::uuid IS NULL AND p.created_at < $1)
                                      OR ($2 IS NOT NULL
                                          AND (p.created_at, p.id) < ($1, $2)))))
               ORDER BY
                   CASE WHEN $3 THEN p.created_at END ASC,
                   CASE WHEN $3 THEN p.id END ASC,
                   p.created_at DESC, p.id DESC
               LIMIT $4
           ) page
           ORDER BY created_at DESC, id DESC"#,
        at,
        after_id,
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
        license: row.license,
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
    license: String,
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
        r#"SELECT c.id, c.target_id, c.target_type, c.author_id,
                  c.l1_node_id, c.license, c.landed_epoch, c.act_time,
                  c.position, c.created_at,
                  v.content AS "content!", v.redaction_reason,
                  v.pending AS "version_pending!",
                  v.created_at AS "version_created_at!"
           FROM comments c
           JOIN LATERAL (
               SELECT content, redaction_reason, pending, created_at
               FROM comment_versions WHERE comment_id = c.id
               ORDER BY pending DESC,
                        landed_epoch DESC NULLS LAST,
                        act_time DESC NULLS LAST,
                        position DESC NULLS LAST,
                        created_at DESC, version_id DESC
               LIMIT 1
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
        r#"SELECT c.id, c.target_id, c.target_type, c.author_id,
                  c.l1_node_id, c.license, c.landed_epoch, c.act_time,
                  c.position, c.created_at,
                  v.content AS "content!", v.redaction_reason,
                  v.pending AS "version_pending!",
                  v.created_at AS "version_created_at!"
           FROM comments c
           JOIN LATERAL (
               SELECT content, redaction_reason, pending, created_at
               FROM comment_versions WHERE comment_id = c.id
               ORDER BY pending DESC,
                        landed_epoch DESC NULLS LAST,
                        act_time DESC NULLS LAST,
                        position DESC NULLS LAST,
                        created_at DESC, version_id DESC
               LIMIT 1
           ) v ON TRUE
           WHERE c.l1_node_id = $1"#,
        l1_node_id,
    )
    .fetch_optional(pool)
    .await?;
    Ok(row.map(comment_from_row))
}

/// Every comment among `l1_node_ids`, in one round trip — the batched
/// twin of [`comment_by_node`]. An identifier no comment answers to is
/// simply absent from the result.
pub async fn comments_by_nodes(
    pool: &PgPool,
    l1_node_ids: &[String],
) -> Result<Vec<Comment>, ContentError> {
    let rows = sqlx::query_as!(
        CommentRow,
        r#"SELECT c.id, c.target_id, c.target_type, c.author_id,
                  c.l1_node_id, c.license, c.landed_epoch, c.act_time,
                  c.position, c.created_at,
                  v.content AS "content!", v.redaction_reason,
                  v.pending AS "version_pending!",
                  v.created_at AS "version_created_at!"
           FROM comments c
           JOIN LATERAL (
               SELECT content, redaction_reason, pending, created_at
               FROM comment_versions WHERE comment_id = c.id
               ORDER BY pending DESC,
                        landed_epoch DESC NULLS LAST,
                        act_time DESC NULLS LAST,
                        position DESC NULLS LAST,
                        created_at DESC, version_id DESC
               LIMIT 1
           ) v ON TRUE
           WHERE c.l1_node_id = ANY($1)"#,
        l1_node_ids,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(comment_from_row).collect())
}

/// A target's comments — the thread read (comment.md §2): direct
/// children only, newest-first — pending entries, then landed entries in
/// landing order (a comment's landing position is its genesis, so edits
/// never reorder the thread — api-spec.md "Pagination"). `backward`
/// serves `last`/`before`; results always come back newest-first.
pub async fn comments_for_target(
    pool: &PgPool,
    target_id: Uuid,
    cursor: Option<ContentCursor>,
    backward: bool,
    limit: i64,
    include_pending: bool,
) -> Result<Vec<Comment>, ContentError> {
    let cursor = resolve_comment_cursor(pool, cursor).await?;
    merge_walk(
        cursor,
        backward,
        limit,
        include_pending,
        |c, back, n| comments_landed(pool, target_id, c, back, n, include_pending),
        |c, back, n| comments_pending(pool, target_id, c, back, n),
    )
    .await
}

/// The landed branch of the thread read; `include_pending` gates the
/// version lateral for the same reason it does in [`list_posts_landed`].
async fn comments_landed(
    pool: &PgPool,
    target_id: Uuid,
    cursor: Option<LandingOrder>,
    backward: bool,
    limit: i64,
    include_pending: bool,
) -> Result<Vec<Comment>, ContentError> {
    let (ce, ca, cp) = match cursor {
        Some(c) => (Some(c.landed_epoch), Some(c.act_time), Some(c.position)),
        None => (None, None, None),
    };
    let rows = sqlx::query_as!(
        CommentRow,
        r#"SELECT * FROM (
               SELECT c.id, c.target_id, c.target_type, c.author_id,
                      c.l1_node_id, c.license, c.landed_epoch, c.act_time,
                      c.position, c.created_at,
                      v.content AS "content!", v.redaction_reason,
                      v.pending AS "version_pending!",
                      v.created_at AS "version_created_at!"
               FROM comments c
               JOIN LATERAL (
                   SELECT content, redaction_reason, pending, created_at
                   FROM comment_versions
                   WHERE comment_id = c.id AND ($7 OR NOT pending)
                   ORDER BY pending DESC,
                            landed_epoch DESC NULLS LAST,
                            act_time DESC NULLS LAST,
                            position DESC NULLS LAST,
                            created_at DESC, version_id DESC
                   LIMIT 1
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
        include_pending,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(comment_from_row).collect())
}

/// The pending branch of the thread read; same `(instant, id)` keyset as
/// [`list_posts_pending`], and for the same reason.
async fn comments_pending(
    pool: &PgPool,
    target_id: Uuid,
    cursor: (Option<Timestamp>, Option<Uuid>),
    backward: bool,
    limit: i64,
) -> Result<Vec<Comment>, ContentError> {
    let (at, after_id) = cursor;
    let rows = sqlx::query_as!(
        CommentRow,
        r#"SELECT * FROM (
               SELECT c.id, c.target_id, c.target_type, c.author_id,
                      c.l1_node_id, c.license, c.landed_epoch, c.act_time,
                      c.position, c.created_at,
                      v.content AS "content!", v.redaction_reason,
                      v.pending AS "version_pending!",
                      v.created_at AS "version_created_at!"
               FROM comments c
               JOIN LATERAL (
                   SELECT content, redaction_reason, pending, created_at
                   FROM comment_versions WHERE comment_id = c.id
                   ORDER BY pending DESC,
                            landed_epoch DESC NULLS LAST,
                            act_time DESC NULLS LAST,
                            position DESC NULLS LAST,
                            created_at DESC, version_id DESC
                   LIMIT 1
               ) v ON TRUE
               WHERE c.target_id = $5
                 AND c.landed_epoch IS NULL
                 AND ($1::timestamptz IS NULL
                      OR ($3 AND (($2::uuid IS NULL AND c.created_at > $1)
                                  OR ($2 IS NOT NULL
                                      AND (c.created_at, c.id) > ($1, $2))))
                      OR (NOT $3 AND (($2::uuid IS NULL AND c.created_at < $1)
                                      OR ($2 IS NOT NULL
                                          AND (c.created_at, c.id) < ($1, $2)))))
               ORDER BY
                   CASE WHEN $3 THEN c.created_at END ASC,
                   CASE WHEN $3 THEN c.id END ASC,
                   c.created_at DESC, c.id DESC
               LIMIT $4
           ) page
           ORDER BY created_at DESC, id DESC"#,
        at,
        after_id,
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
