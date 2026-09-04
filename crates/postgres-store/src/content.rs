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
//!
//! # Why the post and comment halves are written twice
//!
//! Eight pairs here are structurally identical, differing only in table
//! name and three columns. They stay separate because the bulk of each
//! pair is a SQL literal and sqlx's macros accept nothing but a literal —
//! not `concat!`, not a `const`, not a macro that expands to one. A
//! generic factoring could therefore share the Rust plumbing around the
//! queries but not the queries, which is where both the volume and the
//! risk are; the result reads worse, not better.
//!
//! What the duplication actually endangers is the version-ordering rule,
//! and that has its own guard: `tests/version_ordering_drift.rs` fails
//! the build if any copy of it drifts, in the crate or in the indexes.

use common::envelope::SensitiveMark;
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
    /// The author's own sensitive mark on this version — the body veils,
    /// the title stays readable. Versioned with the rest of the content
    /// state, so an edit that drops it unmarks the post.
    pub sensitive: bool,
    /// The public reason shown on the veil; None when the author gave
    /// none, and never set without `sensitive`.
    pub sensitive_reason: Option<String>,
    /// Whether the rendered version is an edit that has not landed.
    pub version_pending: bool,
    /// The current version row's timestamp — `updatedAt` when it differs
    /// from `created_at` (data-model.md: updated_at is derived, never
    /// stored).
    pub version_created_at: Timestamp,
    /// The current version row's own key — what the gallery hangs off.
    /// The rendered gallery is that version's junction rows, so the read
    /// side carries the id the same read already resolved rather than
    /// picking the winning version a second time.
    pub version_id: i64,
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
    /// The author's own sensitive mark on this version; same semantics a
    /// post's carries.
    pub sensitive: bool,
    pub sensitive_reason: Option<String>,
    pub version_pending: bool,
    pub version_created_at: Timestamp,
    /// The current version row's own key; the gallery hangs off it, the
    /// same way a post's does.
    pub version_id: i64,
}

impl Comment {
    pub fn sort_key(&self) -> LandingOrder {
        self.order
            .unwrap_or_else(|| LandingOrder::pending_at(self.created_at))
    }
}

/// Inserts a post's entity row and its first version row. `order` is None
/// at the pre-commitment — the row is pending — and Some for a genesis
/// promoted without one (a mirror rebuild).
///
/// Returns the new version row's id, or None when the entity row was
/// already there — so a retried pre-sign neither duplicates the version
/// row nor moves the authoring instant. The caller needs the id because a
/// gallery hangs off the version, not the post.
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
    mark: Option<&SensitiveMark>,
) -> Result<Option<i64>, ContentError> {
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
        return Ok(None);
    }
    let version_id = sqlx::query_scalar!(
        "INSERT INTO post_versions
             (post_id, title, description, content, sensitive,
              sensitive_reason, pending, created_at,
              landed_epoch, act_time, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING version_id",
        id,
        title,
        description,
        content,
        mark.is_some(),
        mark.and_then(|m| m.reason.as_deref()),
        order.is_none(),
        created_at,
        order.map(|o| o.landed_epoch),
        order.map(|o| o.act_time),
        order.map(|o| o.position),
    )
    .fetch_one(&mut **tx)
    .await?;
    Ok(Some(version_id))
}

/// Appends a post version row — an edit. The caller supplies the full
/// merged field set (an edit's unchanged fields are copied forward so the
/// newest row alone renders the post — data-model.md "Display-content
/// versioning"). `order` is None at the pre-commitment — the version is
/// pending — and Some for an edit promoted without one.
///
/// Returns the new row's id, or None when a row for this authoring instant
/// was already there; the caller hangs the edit's gallery off the id.
#[allow(clippy::too_many_arguments)]
pub async fn insert_post_version(
    tx: &mut Transaction<'_, Postgres>,
    post_id: Uuid,
    title: Option<&str>,
    description: Option<&str>,
    content: &str,
    mark: Option<&SensitiveMark>,
    order: Option<LandingOrder>,
    created_at: Timestamp,
) -> Result<Option<i64>, ContentError> {
    Ok(sqlx::query_scalar!(
        "INSERT INTO post_versions
             (post_id, title, description, content, sensitive,
              sensitive_reason, pending, created_at,
              landed_epoch, act_time, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (post_id, created_at) DO NOTHING
         RETURNING version_id",
        post_id,
        title,
        description,
        content,
        mark.is_some(),
        mark.and_then(|m| m.reason.as_deref()),
        order.is_none(),
        created_at,
        order.map(|o| o.landed_epoch),
        order.map(|o| o.act_time),
        order.map(|o| o.position),
    )
    .fetch_optional(&mut **tx)
    .await?)
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
    mark: Option<&SensitiveMark>,
) -> Result<Option<i64>, ContentError> {
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
        return Ok(None);
    }
    let version_id = sqlx::query_scalar!(
        "INSERT INTO comment_versions
             (comment_id, content, sensitive, sensitive_reason, pending,
              created_at, landed_epoch, act_time, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING version_id",
        id,
        content,
        mark.is_some(),
        mark.and_then(|m| m.reason.as_deref()),
        order.is_none(),
        created_at,
        order.map(|o| o.landed_epoch),
        order.map(|o| o.act_time),
        order.map(|o| o.position),
    )
    .fetch_one(&mut **tx)
    .await?;
    Ok(Some(version_id))
}

/// Appends a comment version row — an edit, full merged fields; same
/// version-id contract as [`insert_post_version`].
pub async fn insert_comment_version(
    tx: &mut Transaction<'_, Postgres>,
    comment_id: Uuid,
    content: &str,
    mark: Option<&SensitiveMark>,
    order: Option<LandingOrder>,
    created_at: Timestamp,
) -> Result<Option<i64>, ContentError> {
    Ok(sqlx::query_scalar!(
        "INSERT INTO comment_versions
             (comment_id, content, sensitive, sensitive_reason, pending,
              created_at, landed_epoch, act_time, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (comment_id, created_at) DO NOTHING
         RETURNING version_id",
        comment_id,
        content,
        mark.is_some(),
        mark.and_then(|m| m.reason.as_deref()),
        order.is_none(),
        created_at,
        order.map(|o| o.landed_epoch),
        order.map(|o| o.act_time),
        order.map(|o| o.position),
    )
    .fetch_optional(&mut **tx)
    .await?)
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
/// `node_id` — a pending entity row with its versions, or the pending
/// version row of an unlanded edit, which leaves the previous version
/// rendered.
///
/// A version's gallery goes with the version, without a statement here:
/// the junctions are keyed on the version row and cascade from it. That is
/// what makes an expired edit roll back *whole* — before the gallery was
/// versioned, the text returned to the previous version and the new
/// pictures stayed, so a reader saw the old words under the new gallery
/// and the winning record's manifest disagreed with what was on screen.
///
/// `created_at` is the write's own authoring instant,
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
/// Each one goes whole, since a pending node's versions are all pending by
/// construction and each version's gallery cascades from it. A *landed*
/// comment is left where it is: its record is ordered fact, so it renders
/// as an orphan whose `target` resolves to null.
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

/// Which of `act_ids` carry a payload the controller has reduced
/// (layers.md §5), in one round trip.
///
/// Batched rather than per-act because the field is resolved once per
/// record on a chronicle page, and an act with no payload row at all is
/// simply absent — the reader's answer for both absences is the same:
/// nothing has been removed.
pub async fn reduced_payload_acts(
    pool: &PgPool,
    act_ids: &[String],
) -> Result<Vec<String>, ContentError> {
    Ok(sqlx::query_scalar!(
        r#"SELECT act_id AS "act_id!"
           FROM act_payloads
           WHERE act_id = ANY($1) AND payload_state = 'reduced'"#,
        act_ids,
    )
    .fetch_all(pool)
    .await?)
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
        sensitive: row.sensitive,
        sensitive_reason: row.sensitive_reason,
        version_pending: row.version_pending,
        version_created_at: row.version_created_at,
        version_id: row.version_id,
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
    sensitive: bool,
    sensitive_reason: Option<String>,
    version_pending: bool,
    version_created_at: Timestamp,
    version_id: i64,
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
                  v.sensitive AS "sensitive!", v.sensitive_reason,
                  v.pending AS "version_pending!",
                  v.created_at AS "version_created_at!",
                  v.version_id AS "version_id!"
           FROM posts p
           JOIN LATERAL (
               SELECT title, description, content, redaction_reason,
                      sensitive, sensitive_reason, pending,
                      created_at, version_id
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
                  v.sensitive AS "sensitive!", v.sensitive_reason,
                  v.pending AS "version_pending!",
                  v.created_at AS "version_created_at!",
                  v.version_id AS "version_id!"
           FROM posts p
           JOIN LATERAL (
               SELECT title, description, content, redaction_reason,
                      sensitive, sensitive_reason, pending,
                      created_at, version_id
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
                  v.sensitive AS "sensitive!", v.sensitive_reason,
                  v.pending AS "version_pending!",
                  v.created_at AS "version_created_at!",
                  v.version_id AS "version_id!"
           FROM posts p
           JOIN LATERAL (
               SELECT title, description, content, redaction_reason,
                      sensitive, sensitive_reason, pending,
                      created_at, version_id
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
/// into the other. Results always come back newest-first, whichever way
/// the walk ran.
///
/// Each branch is two statements rather than one, chosen in Rust by
/// `backward`. A single statement can only carry the direction as a
/// parameter, and a parameterised `ORDER BY` is an expression rather than
/// a column list: the planner can match it to the listing index only by
/// const-folding the parameter, which it does under a custom plan and
/// cannot do under a generic one. Written per direction, the sort is the
/// index's own order and no plan mode can lose it.
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
    let rows = if backward {
        sqlx::query_as!(
            PostRow,
            r#"SELECT * FROM (
                   SELECT p.id, p.author_id, p.l1_node_id, p.license,
                          p.landed_epoch, p.act_time, p.position, p.created_at,
                          v.title, v.description,
                          v.content AS "content!", v.redaction_reason,
                          v.sensitive AS "sensitive!", v.sensitive_reason,
                          v.pending AS "version_pending!",
                          v.created_at AS "version_created_at!",
                          v.version_id AS "version_id!"
                   FROM posts p
                   JOIN LATERAL (
                       SELECT title, description, content, redaction_reason,
                              sensitive, sensitive_reason,
                              pending, created_at, version_id
                       FROM post_versions
                       WHERE post_id = p.id AND ($5 OR NOT pending)
                       ORDER BY pending DESC,
                                landed_epoch DESC NULLS LAST,
                                act_time DESC NULLS LAST,
                                position DESC NULLS LAST,
                                created_at DESC, version_id DESC
                       LIMIT 1
                   ) v ON TRUE
                   WHERE p.landed_epoch IS NOT NULL
                     AND ($1::bigint IS NULL
                          OR (p.landed_epoch, p.act_time, p.position) > ($1, $2, $3))
                   ORDER BY p.landed_epoch ASC, p.act_time ASC, p.position ASC
                   LIMIT $4
               ) page
               ORDER BY landed_epoch DESC, act_time DESC, position DESC"#,
            ce,
            ca,
            cp,
            limit,
            include_pending,
        )
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as!(
            PostRow,
            r#"SELECT p.id, p.author_id, p.l1_node_id, p.license,
                      p.landed_epoch, p.act_time, p.position, p.created_at,
                      v.title, v.description,
                      v.content AS "content!", v.redaction_reason,
                      v.sensitive AS "sensitive!", v.sensitive_reason,
                      v.pending AS "version_pending!",
                      v.created_at AS "version_created_at!",
                      v.version_id AS "version_id!"
               FROM posts p
               JOIN LATERAL (
                   SELECT title, description, content, redaction_reason,
                          sensitive, sensitive_reason,
                          pending, created_at, version_id
                   FROM post_versions
                   WHERE post_id = p.id AND ($5 OR NOT pending)
                   ORDER BY pending DESC,
                            landed_epoch DESC NULLS LAST,
                            act_time DESC NULLS LAST,
                            position DESC NULLS LAST,
                            created_at DESC, version_id DESC
                   LIMIT 1
               ) v ON TRUE
               WHERE p.landed_epoch IS NOT NULL
                 AND ($1::bigint IS NULL
                      OR (p.landed_epoch, p.act_time, p.position) < ($1, $2, $3))
               ORDER BY p.landed_epoch DESC, p.act_time DESC, p.position DESC
               LIMIT $4"#,
            ce,
            ca,
            cp,
            limit,
            include_pending,
        )
        .fetch_all(pool)
        .await?
    };
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
    let rows = if backward {
        sqlx::query_as!(
            PostRow,
            r#"SELECT * FROM (
                   SELECT p.id, p.author_id, p.l1_node_id, p.license,
                          p.landed_epoch, p.act_time, p.position, p.created_at,
                          v.title, v.description,
                          v.content AS "content!", v.redaction_reason,
                          v.sensitive AS "sensitive!", v.sensitive_reason,
                          v.pending AS "version_pending!",
                          v.created_at AS "version_created_at!",
                          v.version_id AS "version_id!"
                   FROM posts p
                   JOIN LATERAL (
                       SELECT title, description, content, redaction_reason,
                              sensitive, sensitive_reason,
                              pending, created_at, version_id
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
                          OR ($2::uuid IS NULL AND p.created_at > $1)
                          OR ($2 IS NOT NULL AND (p.created_at, p.id) > ($1, $2)))
                   ORDER BY p.created_at ASC, p.id ASC
                   LIMIT $3
               ) page
               ORDER BY created_at DESC, id DESC"#,
            at,
            after_id,
            limit,
        )
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as!(
            PostRow,
            r#"SELECT p.id, p.author_id, p.l1_node_id, p.license,
                      p.landed_epoch, p.act_time, p.position, p.created_at,
                      v.title, v.description,
                      v.content AS "content!", v.redaction_reason,
                      v.sensitive AS "sensitive!", v.sensitive_reason,
                      v.pending AS "version_pending!",
                      v.created_at AS "version_created_at!",
                      v.version_id AS "version_id!"
               FROM posts p
               JOIN LATERAL (
                   SELECT title, description, content, redaction_reason,
                          sensitive, sensitive_reason,
                          pending, created_at, version_id
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
                      OR ($2::uuid IS NULL AND p.created_at < $1)
                      OR ($2 IS NOT NULL AND (p.created_at, p.id) < ($1, $2)))
               ORDER BY p.created_at DESC, p.id DESC
               LIMIT $3"#,
            at,
            after_id,
            limit,
        )
        .fetch_all(pool)
        .await?
    };
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
        sensitive: row.sensitive,
        sensitive_reason: row.sensitive_reason,
        version_pending: row.version_pending,
        version_created_at: row.version_created_at,
        version_id: row.version_id,
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
    sensitive: bool,
    sensitive_reason: Option<String>,
    version_pending: bool,
    version_created_at: Timestamp,
    version_id: i64,
}

/// One comment with its current version; None for an unknown id.
pub async fn comment(pool: &PgPool, id: Uuid) -> Result<Option<Comment>, ContentError> {
    let row = sqlx::query_as!(
        CommentRow,
        r#"SELECT c.id, c.target_id, c.target_type, c.author_id,
                  c.l1_node_id, c.license, c.landed_epoch, c.act_time,
                  c.position, c.created_at,
                  v.content AS "content!", v.redaction_reason,
                  v.sensitive AS "sensitive!", v.sensitive_reason,
                  v.pending AS "version_pending!",
                  v.created_at AS "version_created_at!",
                  v.version_id AS "version_id!"
           FROM comments c
           JOIN LATERAL (
               SELECT content, redaction_reason, sensitive, sensitive_reason,
                      pending, created_at, version_id
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
                  v.sensitive AS "sensitive!", v.sensitive_reason,
                  v.pending AS "version_pending!",
                  v.created_at AS "version_created_at!",
                  v.version_id AS "version_id!"
           FROM comments c
           JOIN LATERAL (
               SELECT content, redaction_reason, sensitive, sensitive_reason,
                      pending, created_at, version_id
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
                  v.sensitive AS "sensitive!", v.sensitive_reason,
                  v.pending AS "version_pending!",
                  v.created_at AS "version_created_at!",
                  v.version_id AS "version_id!"
           FROM comments c
           JOIN LATERAL (
               SELECT content, redaction_reason, sensitive, sensitive_reason,
                      pending, created_at, version_id
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
    let rows = if backward {
        sqlx::query_as!(
            CommentRow,
            r#"SELECT * FROM (
                   SELECT c.id, c.target_id, c.target_type, c.author_id,
                          c.l1_node_id, c.license, c.landed_epoch, c.act_time,
                          c.position, c.created_at,
                          v.content AS "content!", v.redaction_reason,
                          v.sensitive AS "sensitive!", v.sensitive_reason,
                          v.pending AS "version_pending!",
                          v.created_at AS "version_created_at!",
                          v.version_id AS "version_id!"
                   FROM comments c
                   JOIN LATERAL (
                       SELECT content, redaction_reason, sensitive,
                              sensitive_reason, pending, created_at, version_id
                       FROM comment_versions
                       WHERE comment_id = c.id AND ($6 OR NOT pending)
                       ORDER BY pending DESC,
                                landed_epoch DESC NULLS LAST,
                                act_time DESC NULLS LAST,
                                position DESC NULLS LAST,
                                created_at DESC, version_id DESC
                       LIMIT 1
                   ) v ON TRUE
                   WHERE c.target_id = $5
                     AND c.landed_epoch IS NOT NULL
                     AND ($1::bigint IS NULL
                          OR (c.landed_epoch, c.act_time, c.position) > ($1, $2, $3))
                   ORDER BY c.landed_epoch ASC, c.act_time ASC, c.position ASC
                   LIMIT $4
               ) page
               ORDER BY landed_epoch DESC, act_time DESC, position DESC"#,
            ce,
            ca,
            cp,
            limit,
            target_id,
            include_pending,
        )
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as!(
            CommentRow,
            r#"SELECT c.id, c.target_id, c.target_type, c.author_id,
                      c.l1_node_id, c.license, c.landed_epoch, c.act_time,
                      c.position, c.created_at,
                      v.content AS "content!", v.redaction_reason,
                      v.sensitive AS "sensitive!", v.sensitive_reason,
                      v.pending AS "version_pending!",
                      v.created_at AS "version_created_at!",
                      v.version_id AS "version_id!"
               FROM comments c
               JOIN LATERAL (
                   SELECT content, redaction_reason, sensitive,
                          sensitive_reason, pending, created_at, version_id
                   FROM comment_versions
                   WHERE comment_id = c.id AND ($6 OR NOT pending)
                   ORDER BY pending DESC,
                            landed_epoch DESC NULLS LAST,
                            act_time DESC NULLS LAST,
                            position DESC NULLS LAST,
                            created_at DESC, version_id DESC
                   LIMIT 1
               ) v ON TRUE
               WHERE c.target_id = $5
                 AND c.landed_epoch IS NOT NULL
                 AND ($1::bigint IS NULL
                      OR (c.landed_epoch, c.act_time, c.position) < ($1, $2, $3))
               ORDER BY c.landed_epoch DESC, c.act_time DESC, c.position DESC
               LIMIT $4"#,
            ce,
            ca,
            cp,
            limit,
            target_id,
            include_pending,
        )
        .fetch_all(pool)
        .await?
    };
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
    let rows = if backward {
        sqlx::query_as!(
            CommentRow,
            r#"SELECT * FROM (
                   SELECT c.id, c.target_id, c.target_type, c.author_id,
                          c.l1_node_id, c.license, c.landed_epoch, c.act_time,
                          c.position, c.created_at,
                          v.content AS "content!", v.redaction_reason,
                          v.sensitive AS "sensitive!", v.sensitive_reason,
                          v.pending AS "version_pending!",
                          v.created_at AS "version_created_at!",
                          v.version_id AS "version_id!"
                   FROM comments c
                   JOIN LATERAL (
                       SELECT content, redaction_reason, sensitive,
                              sensitive_reason, pending, created_at, version_id
                       FROM comment_versions WHERE comment_id = c.id
                       ORDER BY pending DESC,
                                landed_epoch DESC NULLS LAST,
                                act_time DESC NULLS LAST,
                                position DESC NULLS LAST,
                                created_at DESC, version_id DESC
                       LIMIT 1
                   ) v ON TRUE
                   WHERE c.target_id = $4
                     AND c.landed_epoch IS NULL
                     AND ($1::timestamptz IS NULL
                          OR ($2::uuid IS NULL AND c.created_at > $1)
                          OR ($2 IS NOT NULL AND (c.created_at, c.id) > ($1, $2)))
                   ORDER BY c.created_at ASC, c.id ASC
                   LIMIT $3
               ) page
               ORDER BY created_at DESC, id DESC"#,
            at,
            after_id,
            limit,
            target_id,
        )
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as!(
            CommentRow,
            r#"SELECT c.id, c.target_id, c.target_type, c.author_id,
                      c.l1_node_id, c.license, c.landed_epoch, c.act_time,
                      c.position, c.created_at,
                      v.content AS "content!", v.redaction_reason,
                      v.sensitive AS "sensitive!", v.sensitive_reason,
                      v.pending AS "version_pending!",
                      v.created_at AS "version_created_at!",
                      v.version_id AS "version_id!"
               FROM comments c
               JOIN LATERAL (
                   SELECT content, redaction_reason, sensitive,
                          sensitive_reason, pending, created_at, version_id
                   FROM comment_versions WHERE comment_id = c.id
                   ORDER BY pending DESC,
                            landed_epoch DESC NULLS LAST,
                            act_time DESC NULLS LAST,
                            position DESC NULLS LAST,
                            created_at DESC, version_id DESC
                   LIMIT 1
               ) v ON TRUE
               WHERE c.target_id = $4
                 AND c.landed_epoch IS NULL
                 AND ($1::timestamptz IS NULL
                      OR ($2::uuid IS NULL AND c.created_at < $1)
                      OR ($2 IS NOT NULL AND (c.created_at, c.id) < ($1, $2)))
               ORDER BY c.created_at DESC, c.id DESC
               LIMIT $3"#,
            at,
            after_id,
            limit,
            target_id,
        )
        .fetch_all(pool)
        .await?
    };
    Ok(rows.into_iter().map(comment_from_row).collect())
}

/// How many entries the thread read serves for this target under the
/// same filter, cursor-independent — what a "view n replies" affordance
/// counts before any page is fetched.
///
/// The filter mirrors [`comments_for_target`] branch for branch, so the
/// count can never disagree with the edges beside it: `include_pending`
/// admits the unlanded entities exactly as `merge_walk` does, and the
/// `EXISTS` restates the version lateral's row-elimination — that lateral
/// is an inner join, so an entry with no version passing the gate is
/// absent from the page and must be absent from the count.
pub async fn count_comments_for_target(
    pool: &PgPool,
    target_id: Uuid,
    include_pending: bool,
) -> Result<i64, ContentError> {
    Ok(sqlx::query_scalar!(
        r#"SELECT COUNT(*)::bigint AS "total!"
           FROM comments c
           WHERE c.target_id = $1
             AND ($2 OR c.landed_epoch IS NOT NULL)
             AND EXISTS (
                 SELECT 1 FROM comment_versions v
                 WHERE v.comment_id = c.id AND ($2 OR NOT v.pending)
             )"#,
        target_id,
        include_pending,
    )
    .fetch_one(pool)
    .await?)
}

/// A content id with the class that answers for it and the node it
/// minted.
#[derive(Debug, Clone)]
pub struct ContentRef {
    pub id: Uuid,
    /// `"post"` or `"comment"` — the entity table the row came from.
    pub kind: String,
    pub l1_node_id: String,
}

/// The class and minted node of every content id among `ids`, in one
/// round trip — the batched dispatch behind `node`/`nodes`. An id that
/// names no content is simply absent.
///
/// The entity tables are the registry, pending rows included; the two
/// arms are disjoint, so a UUID appears at most once.
pub async fn content_refs(pool: &PgPool, ids: &[Uuid]) -> Result<Vec<ContentRef>, ContentError> {
    Ok(sqlx::query_as!(
        ContentRef,
        r#"SELECT id AS "id!", 'post' AS "kind!", l1_node_id AS "l1_node_id!"
           FROM posts WHERE id = ANY($1)
           UNION ALL
           SELECT id AS "id!", 'comment' AS "kind!", l1_node_id AS "l1_node_id!"
           FROM comments WHERE id = ANY($1)"#,
        ids,
    )
    .fetch_all(pool)
    .await?)
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

#[cfg(test)]
mod tests {
    use super::*;

    fn landed(epoch: i64) -> LandingOrder {
        LandingOrder {
            landed_epoch: epoch,
            act_time: 0,
            position: 0,
        }
    }

    fn at(micros: i64) -> Timestamp {
        chrono::DateTime::from_timestamp_micros(micros).expect("in range")
    }

    /// The pending namespace is the sentinel epoch, and a pending key
    /// carries the authoring instant it was built from. The round trip
    /// matters because the walk resumes from it: a key that cannot say
    /// which instant it means cannot resume a page.
    ///
    /// A pending key names the sentinel namespace and carries the instant it was built from.
    /// ´claim:content:a-pending-key-carries-its-authoring-instant´
    #[test]
    fn a_pending_key_carries_its_authoring_instant() {
        let key = LandingOrder::pending_at(at(1_700_000_000_000_000));
        assert!(key.is_pending());
        assert_eq!(key.landed_epoch, PENDING_EPOCH);
        assert_eq!(key.pending_instant(), Some(at(1_700_000_000_000_000)));
        assert!(!landed(3).is_pending());
        assert_eq!(landed(3).pending_instant(), None);
    }

    /// Every pending key sorts above every landed one — the property the
    /// two-branch walk is built on, and the reason the cursor keeps one
    /// shape across both namespaces.
    ///
    /// Every pending key sorts above every landed one.
    /// ´claim:content:pending-keys-sort-above-landed-ones´
    #[test]
    fn every_pending_key_outranks_every_landed_one() {
        assert!(LandingOrder::pending_at(at(0)) > landed(i64::MAX - 1));
    }

    /// A landed row sorts by its coordinates and an unlanded one by its
    /// authoring instant — the same key either way, so the caller never
    /// branches on which it got.
    ///
    /// An unlanded row's sort key is its authoring instant, a landed one's its coordinates.
    /// ´claim:content:a-sort-key-falls-back-to-the-authoring-instant´
    #[test]
    fn a_sort_key_falls_back_to_the_authoring_instant() {
        let created = at(42);
        let post = Post {
            id: Uuid::nil(),
            author_id: Uuid::nil(),
            l1_node_id: String::new(),
            license: String::new(),
            order: None,
            created_at: created,
            title: None,
            description: None,
            content: String::new(),
            redaction_reason: None,
            sensitive: false,
            sensitive_reason: None,
            version_pending: false,
            version_created_at: created,
            version_id: 0,
        };
        assert_eq!(post.sort_key(), LandingOrder::pending_at(created));
        let landed_post = Post {
            order: Some(landed(7)),
            ..post
        };
        assert_eq!(landed_post.sort_key(), landed(7));
    }

    /// The table's CHECK admits all three coordinates or none, so a row
    /// carrying part of a position reads as pending rather than as a
    /// position with holes in it.
    ///
    /// A row holding part of a landing position holds no position at all.
    /// ´claim:content:a-partial-position-is-no-position´
    #[test]
    fn a_partial_position_is_no_position() {
        assert_eq!(
            landing_order(Some(1), Some(2), Some(3)).map(|o| o.position),
            Some(3)
        );
        assert_eq!(landing_order(Some(1), Some(2), None), None);
        assert_eq!(landing_order(None, None, None), None);
    }

    /// Only a pending cursor moves, and only one carrying an id can be
    /// found again — so those are the only cursors worth re-reading.
    ///
    /// Only a pending cursor carrying an id is worth re-reading.
    /// ´claim:content:only-a-findable-pending-cursor-is-re-read´
    #[test]
    fn only_a_findable_pending_cursor_is_re_read() {
        let id = Uuid::from_u128(1);
        let pending = ContentCursor {
            order: LandingOrder::pending_at(at(9)),
            id: Some(id),
        };
        assert_eq!(movable(Some(pending)), Some(id));
        assert_eq!(
            movable(Some(ContentCursor {
                id: None,
                ..pending
            })),
            None
        );
        assert_eq!(
            movable(Some(ContentCursor {
                order: landed(1),
                id: Some(id)
            })),
            None
        );
        assert_eq!(movable(None), None);
    }

    /// A cursor re-points at the coordinates its entry has now, keeping
    /// its id; an entry still pending leaves it standing.
    ///
    /// Re-pointing a cursor moves its key and keeps its id.
    /// ´claim:content:re-pointing-keeps-the-cursors-id´
    #[test]
    fn re_pointing_keeps_the_cursors_id() {
        let id = Uuid::from_u128(2);
        let cursor = ContentCursor {
            order: LandingOrder::pending_at(at(9)),
            id: Some(id),
        };
        let moved = repoint(Some(cursor), Some(landed(5))).expect("some");
        assert_eq!(moved.order, landed(5));
        assert_eq!(moved.id, Some(id));
        assert_eq!(
            repoint(Some(cursor), None).expect("some").order,
            cursor.order
        );
    }

    /// The pending branch keysets from a pending cursor and from nothing
    /// else: a landed cursor is in the other namespace, so the pending
    /// branch is walked from its own end instead.
    ///
    /// The pending branch keysets from a pending cursor and from nothing else.
    /// ´claim:content:the-pending-keyset-comes-only-from-a-pending-cursor´
    #[test]
    fn the_pending_keyset_comes_only_from_a_pending_cursor() {
        let id = Uuid::from_u128(3);
        let pending = ContentCursor {
            order: LandingOrder::pending_at(at(9)),
            id: Some(id),
        };
        assert_eq!(pending_from(Some(pending)), (Some(at(9)), Some(id)));
        assert_eq!(
            pending_from(Some(ContentCursor {
                order: landed(1),
                id: Some(id)
            })),
            (None, None)
        );
        assert_eq!(pending_from(None), (None, None));
    }

    type LandedAsk = (Option<LandingOrder>, bool, i64);
    type PendingAsk = ((Option<Timestamp>, Option<Uuid>), bool, i64);

    /// What each branch of a walk was asked for — enough to assert the
    /// merge's shape without a database behind it.
    #[derive(Debug, Default, Clone)]
    struct Calls {
        landed: Vec<LandedAsk>,
        pending: Vec<PendingAsk>,
    }

    async fn walk(
        cursor: Option<ContentCursor>,
        backward: bool,
        limit: i64,
        include_pending: bool,
        pending_rows: Vec<i32>,
        landed_rows: Vec<i32>,
    ) -> (Vec<i32>, Calls) {
        let calls = std::cell::RefCell::new(Calls::default());
        let out = merge_walk(
            cursor,
            backward,
            limit,
            include_pending,
            |c, back, n| {
                calls.borrow_mut().landed.push((c, back, n));
                let rows = landed_rows.clone();
                async move { Ok(rows.into_iter().take(n.max(0) as usize).collect()) }
            },
            |c, back, n| {
                calls.borrow_mut().pending.push((c, back, n));
                let rows = pending_rows.clone();
                async move { Ok(rows.into_iter().take(n.max(0) as usize).collect()) }
            },
        )
        .await
        .expect("walk");
        (out, calls.into_inner())
    }

    /// A forward walk from the start fills from the pending branch first
    /// and asks the landed branch only for what is left — the namespaces
    /// never interleave, so the merge is a concatenation and not a sort.
    ///
    /// A forward walk fills from pending first and asks landed only for the remainder.
    /// ´claim:content:a-walk-fills-one-branch-then-asks-the-other-for-the-rest´
    #[tokio::test]
    async fn a_forward_walk_fills_pending_then_landed() {
        let (out, calls) = walk(None, false, 5, true, vec![1, 2], vec![3, 4, 5, 6]).await;
        assert_eq!(out, vec![1, 2, 3, 4, 5]);
        assert_eq!(calls.pending.len(), 1);
        assert_eq!(calls.pending[0].2, 5);
        assert_eq!(calls.landed.len(), 1);
        assert_eq!(calls.landed[0].2, 3, "asks only for the remainder");
    }

    /// Excluding pending skips that branch entirely rather than asking
    /// for it and discarding the answer.
    ///
    /// A settled walk never asks the pending branch anything.
    /// ´claim:content:a-settled-walk-never-asks-the-pending-branch´
    #[tokio::test]
    async fn a_settled_walk_never_asks_the_pending_branch() {
        let (out, calls) = walk(None, false, 2, false, vec![1, 2], vec![7, 8, 9]).await;
        assert_eq!(out, vec![7, 8]);
        assert!(calls.pending.is_empty());
    }

    /// A backward walk runs the branches in the other order and still
    /// returns newest-first: the pending rows lead the landed ones on the
    /// way out, whichever way the walk ran.
    ///
    /// A backward walk runs the branches in the other order and still returns newest-first.
    /// ´claim:content:a-walk-returns-newest-first-whichever-way-it-ran´
    #[tokio::test]
    async fn a_backward_walk_returns_newest_first() {
        let (out, calls) = walk(
            Some(ContentCursor {
                order: landed(4),
                id: None,
            }),
            true,
            5,
            true,
            vec![1, 2],
            vec![3, 4],
        )
        .await;
        assert_eq!(out, vec![1, 2, 3, 4]);
        assert!(calls.landed[0].1, "the landed branch is asked backward");
        assert_eq!(calls.pending[0].2, 3, "and pending for the remainder");
    }

    /// A cursor already in the pending namespace does not re-walk the
    /// landed branch behind it on the way back.
    ///
    /// A backward walk from a pending cursor never re-walks the landed branch.
    /// ´claim:content:a-backward-walk-from-pending-skips-the-landed-branch´
    #[tokio::test]
    async fn a_backward_walk_from_a_pending_cursor_skips_the_landed_branch() {
        let (out, calls) = walk(
            Some(ContentCursor {
                order: LandingOrder::pending_at(at(9)),
                id: None,
            }),
            true,
            3,
            true,
            vec![1, 2],
            vec![3, 4],
        )
        .await;
        assert_eq!(out, vec![1, 2]);
        assert!(calls.landed.is_empty());
    }
}
