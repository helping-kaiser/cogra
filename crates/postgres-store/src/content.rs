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
use common::redact::ByteLen;
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
/// its `(epoch, position)` form. Pending entries sort among themselves by
/// authoring instant, in microseconds, carried in the position slot.
pub const PENDING_EPOCH: i64 = i64::MAX;

/// The genesis record's key of record `(epoch, position)` — the listing
/// sort key, compared lexicographically (layer1-interface.md §8.3).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct LandingOrder {
    pub landed_epoch: i64,
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
            position: created_at.timestamp_micros(),
        }
    }

    /// The authoring instant a pending key encodes; None for a landed key
    /// or an out-of-range value.
    fn pending_instant(&self) -> Option<Timestamp> {
        self.is_pending()
            .then(|| chrono::DateTime::from_timestamp_micros(self.position))
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
///
/// `horizon` is the walk's snapshot (api-spec.md "A page is a snapshot"):
/// the newest landing key the listing held when the walk's first page was
/// read. The listing every later page of the walk reads is the one as of
/// that page — an entry that has landed above the horizon since is still
/// read where it stood, among the settling entries, so it can neither be
/// served again out of the landed namespace nor be skipped by a boundary
/// that moved past it. A cursor without one predates it: the walk then
/// re-resolves the cursor's own entry, as it did before the horizon was
/// carried.
#[derive(Debug, Clone, Copy)]
pub struct ContentCursor {
    pub order: LandingOrder,
    pub id: Option<Uuid>,
    pub horizon: Option<LandingOrder>,
}

impl ContentCursor {
    /// The cursor of one listed entry, in the walk that served it under
    /// `horizon`.
    pub fn of<T: Listed>(entry: &T, horizon: Option<LandingOrder>) -> Self {
        Self {
            order: entry.view_key(horizon),
            id: entry.entry_id(),
            horizon,
        }
    }
}

/// The horizon of a listing that held no landed entry yet: below every
/// key of record, which is numbered from one.
const EMPTY_HORIZON: LandingOrder = LandingOrder {
    landed_epoch: 0,
    position: 0,
};

/// One page of a listing walk, with the horizon its cursors carry. `None`
/// only for a walk that carries none: a settled read, or one resumed from a
/// cursor that predates the horizon.
#[derive(Debug, Clone)]
pub struct Listing<T> {
    pub items: Vec<T>,
    pub horizon: Option<LandingOrder>,
}

/// An entry of a listing that pages across the settling and landed
/// namespaces.
pub trait Listed {
    /// The landing key, once landed.
    fn landed_key(&self) -> Option<LandingOrder>;
    /// Where the entry sorts in the walk fixed at `horizon`: its landing
    /// key if it had landed by then, its pending key otherwise.
    fn view_key(&self, horizon: Option<LandingOrder>) -> LandingOrder;
    /// The id a cursor carries, if the entry has one.
    fn entry_id(&self) -> Option<Uuid>;
}

/// The view key of a content row: landed at or below the horizon reads in
/// the landed namespace, anything else in the pending one.
fn content_view_key(
    order: Option<LandingOrder>,
    created_at: Timestamp,
    horizon: Option<LandingOrder>,
) -> LandingOrder {
    match order {
        Some(o) if horizon.is_none_or(|h| o <= h) => o,
        _ => LandingOrder::pending_at(created_at),
    }
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

impl Listed for Post {
    fn landed_key(&self) -> Option<LandingOrder> {
        self.order
    }

    fn view_key(&self, horizon: Option<LandingOrder>) -> LandingOrder {
        content_view_key(self.order, self.created_at, horizon)
    }

    fn entry_id(&self) -> Option<Uuid> {
        Some(self.id)
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

impl Listed for Comment {
    fn landed_key(&self) -> Option<LandingOrder> {
        self.order
    }

    fn view_key(&self, horizon: Option<LandingOrder>) -> LandingOrder {
        content_view_key(self.order, self.created_at, horizon)
    }

    fn entry_id(&self) -> Option<Uuid> {
        Some(self.id)
    }
}

/// Inserts a post's entity row and its first version row. `landing` is None
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
    landing: Option<LandingOrder>,
    created_at: Timestamp,
    title: Option<&str>,
    description: Option<&str>,
    content: &str,
    mark: Option<&SensitiveMark>,
) -> Result<Option<i64>, ContentError> {
    let inserted = sqlx::query!(
        "INSERT INTO posts
             (id, author_id, l1_node_id, license, landed_epoch, position,
              created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING",
        id,
        author_id,
        l1_node_id,
        license,
        landing.map(|l| l.landed_epoch),
        landing.map(|l| l.position),
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
              landed_epoch, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING version_id",
        id,
        title,
        description,
        content,
        mark.is_some(),
        mark.and_then(|m| m.reason.as_deref()),
        landing.is_none(),
        created_at,
        landing.map(|l| l.landed_epoch),
        landing.map(|l| l.position),
    )
    .fetch_one(&mut **tx)
    .await?;
    Ok(Some(version_id))
}

/// Appends a post version row — an edit. The caller supplies the full
/// merged field set (an edit's unchanged fields are copied forward so the
/// newest row alone renders the post — data-model.md "Display-content
/// versioning"). `landing` is None at the pre-commitment — the version is
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
    landing: Option<LandingOrder>,
    created_at: Timestamp,
) -> Result<Option<i64>, ContentError> {
    Ok(sqlx::query_scalar!(
        "INSERT INTO post_versions
             (post_id, title, description, content, sensitive,
              sensitive_reason, pending, created_at,
              landed_epoch, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (post_id, created_at) DO NOTHING
         RETURNING version_id",
        post_id,
        title,
        description,
        content,
        mark.is_some(),
        mark.and_then(|m| m.reason.as_deref()),
        landing.is_none(),
        created_at,
        landing.map(|l| l.landed_epoch),
        landing.map(|l| l.position),
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
    landing: Option<LandingOrder>,
    created_at: Timestamp,
    content: &str,
    mark: Option<&SensitiveMark>,
) -> Result<Option<i64>, ContentError> {
    let inserted = sqlx::query!(
        "INSERT INTO comments
             (id, target_id, target_type, author_id, l1_node_id, license,
              landed_epoch, position, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING",
        id,
        target_id,
        target_type,
        author_id,
        l1_node_id,
        license,
        landing.map(|l| l.landed_epoch),
        landing.map(|l| l.position),
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
              created_at, landed_epoch, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING version_id",
        id,
        content,
        mark.is_some(),
        mark.and_then(|m| m.reason.as_deref()),
        landing.is_none(),
        created_at,
        landing.map(|l| l.landed_epoch),
        landing.map(|l| l.position),
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
    landing: Option<LandingOrder>,
    created_at: Timestamp,
) -> Result<Option<i64>, ContentError> {
    Ok(sqlx::query_scalar!(
        "INSERT INTO comment_versions
             (comment_id, content, sensitive, sensitive_reason, pending,
              created_at, landed_epoch, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (comment_id, created_at) DO NOTHING
         RETURNING version_id",
        comment_id,
        content,
        mark.is_some(),
        mark.and_then(|m| m.reason.as_deref()),
        landing.is_none(),
        created_at,
        landing.map(|l| l.landed_epoch),
        landing.map(|l| l.position),
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
    landing: LandingOrder,
) -> Result<bool, ContentError> {
    Ok(sqlx::query!(
        "UPDATE posts SET landed_epoch = $2, position = $3 WHERE id = $1",
        id,
        landing.landed_epoch,
        landing.position,
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
    landing: LandingOrder,
) -> Result<bool, ContentError> {
    Ok(sqlx::query!(
        "UPDATE post_versions
            SET pending = FALSE, landed_epoch = $3, position = $4
         WHERE post_id = $1 AND created_at = $2 AND pending",
        post_id,
        created_at,
        landing.landed_epoch,
        landing.position,
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
    landing: LandingOrder,
) -> Result<bool, ContentError> {
    Ok(sqlx::query!(
        "UPDATE comments SET landed_epoch = $2, position = $3 WHERE id = $1",
        id,
        landing.landed_epoch,
        landing.position,
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
    landing: LandingOrder,
) -> Result<bool, ContentError> {
    Ok(sqlx::query!(
        "UPDATE comment_versions
            SET pending = FALSE, landed_epoch = $3, position = $4
         WHERE comment_id = $1 AND created_at = $2 AND pending",
        comment_id,
        created_at,
        landing.landed_epoch,
        landing.position,
    )
    .execute(&mut **tx)
    .await?
    .rows_affected()
        == 1)
}

/// Expiry: removes whatever a never-landed write put on screen under
/// `node_id` — a pending entity row with its versions, or the pending
/// version row of an unlanded edit or profile update, which leaves the
/// previous version rendered. A profile update's node is its actor, the
/// UUID its payload envelope carries.
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
///
/// A pending node a removal took down carries one row that is not pending
/// — its head tombstone — and it goes with the node: on the graph nothing
/// ever existed, so there is nothing left to mark.
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
        "DELETE FROM actor_profile_versions
         WHERE (actor_id, created_at)
               IN (SELECT * FROM unnest($1::uuid[], $2::timestamptz[]))
           AND pending",
        nodes,
        instants,
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "DELETE FROM post_versions v
         USING posts p
         WHERE v.post_id = p.id AND p.landed_epoch IS NULL
           AND (p.id, p.created_at)
               IN (SELECT * FROM unnest($1::uuid[], $2::timestamptz[]))",
        nodes,
        instants,
    )
    .execute(&mut **tx)
    .await?;
    sqlx::query!(
        "DELETE FROM comment_versions v
         USING comments c
         WHERE v.comment_id = c.id AND c.landed_epoch IS NULL
           AND (c.id, c.created_at)
               IN (SELECT * FROM unnest($1::uuid[], $2::timestamptz[]))",
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

/// A full carriage row's content: the content pair (payload, content
/// nonce) and the host-drawn content salt (layer1-interface.md §8.2,
/// "Verified act"). The salt and the content pre-digest the pair
/// reproduces open the record's witness.
#[derive(Debug, Clone, Copy)]
pub struct CarriedPair<'a> {
    pub payload: &'a [u8],
    pub content_nonce: &'a [u8],
    pub content_salt: &'a [u8],
}

/// The payload mark follows carriage (data-model.md "The record mirror"):
/// a record is payload-marked exactly when its act has a carriage row,
/// full or reduced. Ingestion reads it when the record arrives
/// ([`crate::mirror::ingest_epoch`]); a carriage row written after that —
/// a promotion that missed the ingestion, a genesis resume — marks the
/// record in the same transaction, so a rebuild from the published
/// sequence reads the same mark the live mirror holds.
async fn mark_carried(conn: &mut sqlx::PgConnection, act_id: &str) -> Result<(), ContentError> {
    sqlx::query!(
        "UPDATE mirror_records SET payload_marked = TRUE
         WHERE record_id = $1 AND NOT payload_marked",
        act_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Promotes the staged carriage of the given acts into `act_payloads`:
/// every staged write among them that holds a sealed, non-empty content
/// pair gets its full carriage row. Runs inside the ingestion's
/// transaction, before the records are inserted, so the payload mark is
/// read off carriage that already stands. Idempotent: a row already
/// there — full or reduced — is kept. A full-empty payload, a write never
/// sealed and one a redaction reaped promote nothing here; the reap left
/// its own reduced row.
///
/// The staged rows are read `FOR SHARE`, which conflicts with the
/// redaction's `FOR UPDATE` on the same row. That orders the two against
/// each other (PostgreSQL manual, "Explicit Locking: Row-Level Locks"
/// and "Transaction Isolation: Read Committed"). If a redaction holds
/// the row, this read waits for it and then re-checks its `WHERE` on the
/// reaped version, so it promotes nothing. If this read holds the row,
/// the redaction waits for the ingestion to commit and then reduces the
/// full row it finds. Without the lock, a plain read of a payload being
/// reaped would land a full row under a redaction that reports it
/// reduced.
///
/// The lock cannot deadlock with a redaction. `ON CONFLICT DO NOTHING`
/// does wait on a conflicting insert that has not committed yet, but
/// every flow takes the staged row before it can wait on a carriage row.
/// This statement locks the staged row in the same statement that
/// inserts the carriage row, and the redaction locks it before it
/// writes carriage. So neither ever waits on the other while holding
/// what the other needs.
pub async fn promote_staged_carriage(
    tx: &mut Transaction<'_, Postgres>,
    act_ids: &[String],
) -> Result<(), ContentError> {
    sqlx::query!(
        "INSERT INTO act_payloads (act_id, payload, content_nonce, content_salt)
         SELECT act_id, payload, content_nonce, content_salt
         FROM staged_writes
         WHERE act_id = ANY($1) AND state <> 'carried'
           AND length(payload) > 0
           AND content_nonce IS NOT NULL AND content_salt IS NOT NULL
         FOR SHARE
         ON CONFLICT (act_id) DO NOTHING",
        act_ids,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Stores an act's content pair and salt — permanent carriage, promoted
/// from the staged row at confirm (layers.md §5). Idempotent on the act
/// id: a re-promotion (mirror rebuild) keeps the first row. Marks the
/// record (see [`mark_carried`]). Returns whether this call inserted the
/// row, as opposed to finding one already there.
pub async fn insert_act_payload(
    tx: &mut Transaction<'_, Postgres>,
    act_id: &str,
    pair: CarriedPair<'_>,
) -> Result<bool, ContentError> {
    let inserted = sqlx::query!(
        "INSERT INTO act_payloads (act_id, payload, content_nonce, content_salt)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (act_id) DO NOTHING",
        act_id,
        pair.payload,
        pair.content_nonce,
        pair.content_salt,
    )
    .execute(&mut **tx)
    .await?
    .rows_affected()
        == 1;
    mark_carried(tx, act_id).await?;
    Ok(inserted)
}

/// Stores a genesis act's carriage, replacing a full row already held
/// under the identifier.
///
/// The genesis bootstrap writes carriage at seal, not at a landing, so its
/// row follows the act's current sealing: a stand-in substrate wiped and
/// re-sealed under the same identifier returns a fresh salt, and the
/// carriage has to open the witness the host holds now. A reduced row is
/// never replaced. The caller moves the content nonce out of the
/// bootstrap's handshake custody on the same transaction
/// ([`crate::genesis::take_carried_content_nonce`]) — the pair has one
/// home at a time.
pub async fn put_genesis_act_payload(
    tx: &mut Transaction<'_, Postgres>,
    act_id: &str,
    pair: CarriedPair<'_>,
) -> Result<(), ContentError> {
    sqlx::query!(
        "INSERT INTO act_payloads (act_id, payload, content_nonce, content_salt)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (act_id) DO UPDATE
         SET payload = EXCLUDED.payload, content_nonce = EXCLUDED.content_nonce,
             content_salt = EXCLUDED.content_salt
         WHERE act_payloads.payload_state = 'full'",
        act_id,
        pair.payload,
        pair.content_nonce,
        pair.content_salt,
    )
    .execute(&mut **tx)
    .await?;
    mark_carried(tx, act_id).await
}

/// Records the carriage of an act whose payload was reduced before it
/// was promoted: the row exists, in `reduced`, holding nothing.
///
/// A redaction reaps the staged copy of an act that has not landed yet,
/// and records its carriage reduced in the same transaction; a landing
/// over it then has no bytes to promote and must not invent any — zero
/// bytes is the canonical empty payload, so an empty row would claim the
/// act carried nothing. Idempotent on the act id, like the full promotion:
/// a row already there is kept. Marks the record (see [`mark_carried`]).
///
/// `reduced_at` is the moment the redaction reaped the staged copy — when
/// the payload actually left — not the landing's: the record's
/// `redactedAt` is the mark's own moment, and the landing only records it.
/// None is the transaction's own moment, for the redaction itself.
pub async fn insert_reduced_act_payload(
    tx: &mut Transaction<'_, Postgres>,
    act_id: &str,
    reduced_at: Option<Timestamp>,
) -> Result<(), ContentError> {
    sqlx::query!(
        "INSERT INTO act_payloads
             (act_id, payload, content_nonce, content_salt, payload_state, reduced_at)
         VALUES ($1, NULL, NULL, NULL, 'reduced', COALESCE($2::timestamptz, NOW()))
         ON CONFLICT (act_id) DO NOTHING",
        act_id,
        reduced_at,
    )
    .execute(&mut **tx)
    .await?;
    mark_carried(tx, act_id).await
}

/// Locks one act's carriage row for a redaction and reads it.
pub async fn lock_act_payload(
    conn: &mut sqlx::PgConnection,
    act_id: &str,
) -> Result<Option<ActPayload>, ContentError> {
    Ok(sqlx::query!(
        "SELECT payload, content_nonce, content_salt, payload_state, reduced_at
         FROM act_payloads WHERE act_id = $1
         FOR UPDATE",
        act_id,
    )
    .fetch_optional(conn)
    .await?
    .map(|row| ActPayload {
        payload: row.payload,
        content_nonce: row.content_nonce,
        content_salt: row.content_salt,
        reduced: row.payload_state == "reduced",
        reduced_at: row.reduced_at,
    }))
}

/// Reduces one act's carriage: payload, content nonce and content salt go
/// to NULL in one statement, the state moves to `reduced` and the moment
/// is kept (layers.md §5; layer1-interface.md §8.4 "Custody across
/// phases": both pair members removed atomically). The row is never
/// deleted. Returns whether this call reduced it — a row already reduced
/// is left exactly as it is.
pub async fn reduce_act_payload(
    conn: &mut sqlx::PgConnection,
    act_id: &str,
) -> Result<bool, ContentError> {
    Ok(sqlx::query!(
        "UPDATE act_payloads
         SET payload = NULL, content_nonce = NULL, content_salt = NULL,
             payload_state = 'reduced', reduced_at = NOW()
         WHERE act_id = $1 AND payload_state = 'full'",
        act_id,
    )
    .execute(conn)
    .await?
    .rows_affected()
        == 1)
}

/// One act's carriage as stored: the content pair and the salt behind its
/// content commitment — all three absent once the controller has reduced
/// it (layers.md §5), never emptied.
#[derive(Clone, PartialEq)]
pub struct ActPayload {
    pub payload: Option<Vec<u8>>,
    pub content_nonce: Option<Vec<u8>>,
    pub content_salt: Option<Vec<u8>>,
    pub reduced: bool,
    pub reduced_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// `Debug` shows the lengths of the payload and the content nonce, never
/// their bytes.
impl std::fmt::Debug for ActPayload {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ActPayload")
            .field("payload", &ByteLen::of_opt(&self.payload))
            .field("content_nonce", &ByteLen::of_opt(&self.content_nonce))
            .field("content_salt", &self.content_salt)
            .field("reduced", &self.reduced)
            .field("reduced_at", &self.reduced_at)
            .finish()
    }
}

/// The carriage of one act, if any row holds it.
pub async fn act_payload(pool: &PgPool, act_id: &str) -> Result<Option<ActPayload>, ContentError> {
    Ok(sqlx::query!(
        "SELECT payload, content_nonce, content_salt, payload_state, reduced_at
         FROM act_payloads WHERE act_id = $1",
        act_id,
    )
    .fetch_optional(pool)
    .await?
    .map(|row| ActPayload {
        payload: row.payload,
        content_nonce: row.content_nonce,
        content_salt: row.content_salt,
        reduced: row.payload_state == "reduced",
        reduced_at: row.reduced_at,
    }))
}

/// Which of `act_ids` carry a payload the controller has reduced
/// (layers.md §5), each with the moment it was reduced, in one round
/// trip.
///
/// Batched rather than per-act because the fields are resolved once per
/// record on a chronicle page, and an act with no payload row at all is
/// simply absent — the reader's answer for both absences is the same:
/// nothing has been removed.
pub async fn reduced_payload_acts(
    pool: &PgPool,
    act_ids: &[String],
) -> Result<Vec<(String, Timestamp)>, ContentError> {
    Ok(sqlx::query!(
        r#"SELECT act_id, reduced_at AS "reduced_at!"
           FROM act_payloads
           WHERE act_id = ANY($1) AND payload_state = 'reduced'"#,
        act_ids,
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| (r.act_id, r.reduced_at))
    .collect())
}

/// The key of record of a row, all-present or all-absent (the table's own
/// CHECK); a mixed row is impossible and reads as pending.
fn landing_order(epoch: Option<i64>, position: Option<i64>) -> Option<LandingOrder> {
    match (epoch, position) {
        (Some(landed_epoch), Some(position)) => Some(LandingOrder {
            landed_epoch,
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
        order: landing_order(row.landed_epoch, row.position),
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
                  p.landed_epoch, p.position, p.created_at,
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
                  p.landed_epoch, p.position, p.created_at,
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
                  p.landed_epoch, p.position, p.created_at,
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
/// The walk reads the listing as of its first page (see
/// [`ContentCursor::horizon`]), so an entry that lands between two pages
/// is served exactly once.
pub async fn list_posts(
    pool: &PgPool,
    cursor: Option<ContentCursor>,
    backward: bool,
    limit: i64,
    include_pending: bool,
) -> Result<Listing<Post>, ContentError> {
    posts_walk(pool, None, cursor, backward, limit, include_pending).await
}

/// One person's posts (a profile's Posts view): [`list_posts`] narrowed to
/// one author, in the same order and the same two cursor namespaces —
/// pending entries ahead of the landed ones (api-spec.md "Pagination").
pub async fn list_posts_by_author(
    pool: &PgPool,
    author: Uuid,
    cursor: Option<ContentCursor>,
    backward: bool,
    limit: i64,
    include_pending: bool,
) -> Result<Listing<Post>, ContentError> {
    posts_walk(pool, Some(author), cursor, backward, limit, include_pending).await
}

/// The post walk both listings share; `author` None is every post.
async fn posts_walk(
    pool: &PgPool,
    author: Option<Uuid>,
    cursor: Option<ContentCursor>,
    backward: bool,
    limit: i64,
    include_pending: bool,
) -> Result<Listing<Post>, ContentError> {
    let cursor = resolve_post_cursor(pool, cursor).await?;
    merge_walk(
        cursor,
        backward,
        limit,
        include_pending,
        |c, back, n| list_posts_landed(pool, author, c, back, n, include_pending),
        |c, back, n| list_posts_pending(pool, author, c, back, n),
    )
    .await
}

/// How many posts the post listing serves under the same filter,
/// cursor-independent — one per post, never an edit, a removed one
/// included (its tombstone is a version). `author` None counts every post.
///
/// The filter restates the walk's branch for branch, as
/// [`count_comments_for_target`] does for the thread, so the count can
/// never disagree with the edges beside it.
pub async fn count_posts(
    pool: &PgPool,
    author: Option<Uuid>,
    include_pending: bool,
) -> Result<i64, ContentError> {
    Ok(sqlx::query_scalar!(
        r#"SELECT COUNT(*)::bigint AS "total!"
           FROM posts p
           WHERE ($1::uuid IS NULL OR p.author_id = $1)
             AND ($2 OR p.landed_epoch IS NOT NULL)
             AND EXISTS (
                 SELECT 1 FROM post_versions v
                 WHERE v.post_id = p.id AND ($2 OR NOT v.pending)
             )"#,
        author,
        include_pending,
    )
    .fetch_one(pool)
    .await?)
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
///
/// The error type is the branches' own, so a walk whose landed branch is
/// the record mirror (the chronicle) shares the merge with the content
/// listings.
///
/// **The horizon.** A walk that serves settling entries fixes its
/// horizon on its first page — the newest landing key the listing holds
/// then — and every later page reads the listing as of it: the landed
/// branch serves landings at or below it, the pending branch everything
/// still settling *or* landed above it, in the pending namespace's order.
/// Each entry so keeps the one place it had when the walk began, and a
/// keyset walk over an order that does not move serves every entry
/// exactly once, in either direction. The first page learns the horizon
/// from the newest landed row it read; a page that read none asks the
/// landed branch for its newest row.
///
/// `opens` names that first page: no cursor, and a walk with settling
/// entries in it. A settled read (`include_pending` false) has no
/// settling entries to place and keeps no horizon.
async fn merge_walk<T, E, Landed, Pending, LFut, PFut>(
    cursor: Option<ContentCursor>,
    backward: bool,
    limit: i64,
    include_pending: bool,
    landed: Landed,
    pending: Pending,
) -> Result<Listing<T>, E>
where
    T: Listed,
    Landed: Fn(Option<LandingOrder>, bool, i64) -> LFut,
    Pending: Fn(PendingFrom, bool, i64) -> PFut,
    LFut: std::future::Future<Output = Result<Vec<T>, E>>,
    PFut: std::future::Future<Output = Result<Vec<T>, E>>,
{
    let in_pending = cursor.is_some_and(|c| c.order.is_pending());
    let landed_cursor = cursor.map(|c| c.order).filter(|o| !o.is_pending());
    let opens = include_pending && cursor.is_none();
    let mut horizon = cursor.and_then(|c| c.horizon);
    let mut out = Vec::new();
    if backward {
        if !in_pending {
            let rows = landed(landed_cursor, true, limit).await?;
            if opens && (rows.len() as i64) < limit {
                horizon = Some(newest_landing(&rows));
            }
            out = match horizon {
                Some(h) => rows
                    .into_iter()
                    .filter(|r| r.landed_key().is_some_and(|k| k <= h))
                    .collect(),
                None => rows,
            };
        }
        let remaining = limit - out.len() as i64;
        if include_pending && remaining > 0 {
            let mut head = pending(pending_from(cursor, horizon), true, remaining).await?;
            head.append(&mut out);
            out = head;
        }
    } else {
        if include_pending && (cursor.is_none() || in_pending) {
            out = pending(pending_from(cursor, horizon), false, limit).await?;
        }
        let remaining = limit - out.len() as i64;
        if remaining > 0 {
            let from = landed_cursor.or(horizon.map(just_above));
            let rows = landed(from, false, remaining).await?;
            if opens {
                horizon = Some(newest_landing(&rows));
            }
            out.extend(rows);
        }
    }
    if opens && horizon.is_none() {
        horizon = Some(newest_landing(&landed(None, false, 1).await?));
    }
    Ok(Listing {
        items: out,
        horizon,
    })
}

/// The newest landing among landed-branch rows read newest-first from the
/// top, or the empty horizon when there were none.
fn newest_landing<T: Listed>(newest_first: &[T]) -> LandingOrder {
    newest_first
        .first()
        .and_then(Listed::landed_key)
        .unwrap_or(EMPTY_HORIZON)
}

/// The exclusive landed cursor that admits the horizon itself: the walk's
/// landed branch serves keys below its cursor, and a key of record is a
/// pair of integers, so the key one position on is the tightest bound.
fn just_above(horizon: LandingOrder) -> LandingOrder {
    LandingOrder {
        position: horizon.position.saturating_add(1),
        ..horizon
    }
}

/// Where the pending branch resumes, and the horizon it reads under.
#[derive(Debug, Clone, Copy)]
struct PendingFrom {
    /// The authoring instant of the cursor's entry; None walks the branch
    /// from its own end.
    at: Option<Timestamp>,
    /// The entry id that breaks ties on the instant.
    id: Option<Uuid>,
    /// Rows landed above it still read here; None reads only what is
    /// still settling.
    horizon: Option<LandingOrder>,
}

impl PendingFrom {
    fn horizon_parts(&self) -> (Option<i64>, Option<i64>) {
        match self.horizon {
            Some(h) => (Some(h.landed_epoch), Some(h.position)),
            None => (None, None),
        }
    }
}

/// The pending branch's keyset: the authoring instant and the entry id
/// that breaks ties on it. Empty for a cursor in the landed namespace —
/// the pending branch is then walked from its own end.
fn pending_from(cursor: Option<ContentCursor>, horizon: Option<LandingOrder>) -> PendingFrom {
    let (at, id) = match cursor.filter(|c| c.order.is_pending()) {
        Some(c) => (c.order.pending_instant(), c.id),
        None => (None, None),
    };
    PendingFrom { at, id, horizon }
}

/// The id a pending cursor must be re-checked against, if any: only a
/// pending cursor without a horizon can move — under a horizon its entry
/// keeps its place — and only one carrying an id can be found.
fn movable(cursor: Option<ContentCursor>) -> Option<Uuid> {
    cursor
        .filter(|c| c.order.is_pending() && c.horizon.is_none())
        .and_then(|c| c.id)
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
    let landed = sqlx::query!("SELECT landed_epoch, position FROM posts WHERE id = $1", id)
        .fetch_optional(pool)
        .await?
        .and_then(|r| landing_order(r.landed_epoch, r.position));
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
        "SELECT landed_epoch, position FROM comments WHERE id = $1",
        id
    )
    .fetch_optional(pool)
    .await?
    .and_then(|r| landing_order(r.landed_epoch, r.position));
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
    author: Option<Uuid>,
    cursor: Option<LandingOrder>,
    backward: bool,
    limit: i64,
    include_pending: bool,
) -> Result<Vec<Post>, ContentError> {
    let (ce, cp) = match cursor {
        Some(c) => (Some(c.landed_epoch), Some(c.position)),
        None => (None, None),
    };
    let rows = if backward {
        sqlx::query_as!(
            PostRow,
            r#"SELECT * FROM (
                   SELECT p.id, p.author_id, p.l1_node_id, p.license,
                          p.landed_epoch, p.position, p.created_at,
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
                       WHERE post_id = p.id AND ($4 OR NOT pending)
                       ORDER BY pending DESC,
                                landed_epoch DESC NULLS LAST,
                                position DESC NULLS LAST,
                                created_at DESC, version_id DESC
                       LIMIT 1
                   ) v ON TRUE
                   WHERE p.landed_epoch IS NOT NULL
                     AND ($5::uuid IS NULL OR p.author_id = $5)
                     AND ($1::bigint IS NULL
                          OR (p.landed_epoch, p.position) > ($1, $2))
                   ORDER BY p.landed_epoch ASC, p.position ASC
                   LIMIT $3
               ) page
               ORDER BY landed_epoch DESC, position DESC"#,
            ce,
            cp,
            limit,
            include_pending,
            author,
        )
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as!(
            PostRow,
            r#"SELECT p.id, p.author_id, p.l1_node_id, p.license,
                      p.landed_epoch, p.position, p.created_at,
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
                   WHERE post_id = p.id AND ($4 OR NOT pending)
                   ORDER BY pending DESC,
                            landed_epoch DESC NULLS LAST,
                            position DESC NULLS LAST,
                            created_at DESC, version_id DESC
                   LIMIT 1
               ) v ON TRUE
               WHERE p.landed_epoch IS NOT NULL
                 AND ($5::uuid IS NULL OR p.author_id = $5)
                 AND ($1::bigint IS NULL
                      OR (p.landed_epoch, p.position) < ($1, $2))
               ORDER BY p.landed_epoch DESC, p.position DESC
               LIMIT $3"#,
            ce,
            cp,
            limit,
            include_pending,
            author,
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
/// (`None`) keysets on the instant alone. Under a horizon the branch also
/// reads the rows landed above it (see [`merge_walk`]); with none, the
/// row comparison is NULL and only unlanded rows qualify.
async fn list_posts_pending(
    pool: &PgPool,
    author: Option<Uuid>,
    cursor: PendingFrom,
    backward: bool,
    limit: i64,
) -> Result<Vec<Post>, ContentError> {
    let PendingFrom {
        at, id: after_id, ..
    } = cursor;
    let (he, hp) = cursor.horizon_parts();
    let rows = if backward {
        sqlx::query_as!(
            PostRow,
            r#"SELECT * FROM (
                   SELECT p.id, p.author_id, p.l1_node_id, p.license,
                          p.landed_epoch, p.position, p.created_at,
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
                                position DESC NULLS LAST,
                                created_at DESC, version_id DESC
                       LIMIT 1
                   ) v ON TRUE
                   WHERE (p.landed_epoch IS NULL
                          OR (p.landed_epoch, p.position) > ($5::bigint, $6::bigint))
                     AND ($4::uuid IS NULL OR p.author_id = $4)
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
            author,
            he,
            hp,
        )
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as!(
            PostRow,
            r#"SELECT p.id, p.author_id, p.l1_node_id, p.license,
                      p.landed_epoch, p.position, p.created_at,
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
                            position DESC NULLS LAST,
                            created_at DESC, version_id DESC
                   LIMIT 1
               ) v ON TRUE
               WHERE (p.landed_epoch IS NULL
                      OR (p.landed_epoch, p.position) > ($5::bigint, $6::bigint))
                 AND ($4::uuid IS NULL OR p.author_id = $4)
                 AND ($1::timestamptz IS NULL
                      OR ($2::uuid IS NULL AND p.created_at < $1)
                      OR ($2 IS NOT NULL AND (p.created_at, p.id) < ($1, $2)))
               ORDER BY p.created_at DESC, p.id DESC
               LIMIT $3"#,
            at,
            after_id,
            limit,
            author,
            he,
            hp,
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
        order: landing_order(row.landed_epoch, row.position),
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
                  c.l1_node_id, c.license, c.landed_epoch,
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
                  c.l1_node_id, c.license, c.landed_epoch,
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
                  c.l1_node_id, c.license, c.landed_epoch,
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

/// Which end of a thread a read starts from (api-spec.md `ReplyOrder`).
///
/// Both are the one total order the listing keys define — pending entries
/// newest-authored-first, then landed entries newest-landed-first — read
/// in opposite directions. Oldest-first therefore needs no keyset of its
/// own: the same cursor names the same boundary in either order, and the
/// pending entries, being the newest, close an oldest-first read instead
/// of leading it.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum ThreadOrder {
    #[default]
    NewestFirst,
    OldestFirst,
}

/// A target's comments — the thread read (comment.md §2): direct
/// children only, in `order` — newest-first is pending entries, then
/// landed entries in landing order (a comment's landing position is its
/// genesis, so edits never reorder the thread — api-spec.md
/// "Pagination"); oldest-first is that sequence reversed. `backward`
/// serves `last`/`before` in the requested order; results always come
/// back in it.
///
/// An oldest-first walk is the newest-first walk run the other way and
/// read back reversed: the `limit` entries after a cursor in one order are
/// the `limit` entries before it in the other. Reusing the two-branch walk
/// keeps one set of statements, written per direction for the index (see
/// `merge_walk`), behind both orders.
pub async fn comments_for_target(
    pool: &PgPool,
    target_id: Uuid,
    cursor: Option<ContentCursor>,
    backward: bool,
    limit: i64,
    include_pending: bool,
    order: ThreadOrder,
) -> Result<Listing<Comment>, ContentError> {
    let cursor = resolve_comment_cursor(pool, cursor).await?;
    let oldest_first = order == ThreadOrder::OldestFirst;
    let mut rows = merge_walk(
        cursor,
        backward != oldest_first,
        limit,
        include_pending,
        |c, back, n| comments_landed(pool, target_id, c, back, n, include_pending),
        |c, back, n| comments_pending(pool, target_id, c, back, n),
    )
    .await?;
    if oldest_first {
        rows.items.reverse();
    }
    Ok(rows)
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
    let (ce, cp) = match cursor {
        Some(c) => (Some(c.landed_epoch), Some(c.position)),
        None => (None, None),
    };
    let rows = if backward {
        sqlx::query_as!(
            CommentRow,
            r#"SELECT * FROM (
                   SELECT c.id, c.target_id, c.target_type, c.author_id,
                          c.l1_node_id, c.license, c.landed_epoch,
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
                       WHERE comment_id = c.id AND ($5 OR NOT pending)
                       ORDER BY pending DESC,
                                landed_epoch DESC NULLS LAST,
                                position DESC NULLS LAST,
                                created_at DESC, version_id DESC
                       LIMIT 1
                   ) v ON TRUE
                   WHERE c.target_id = $4
                     AND c.landed_epoch IS NOT NULL
                     AND ($1::bigint IS NULL
                          OR (c.landed_epoch, c.position) > ($1, $2))
                   ORDER BY c.landed_epoch ASC, c.position ASC
                   LIMIT $3
               ) page
               ORDER BY landed_epoch DESC, position DESC"#,
            ce,
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
                      c.l1_node_id, c.license, c.landed_epoch,
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
                   WHERE comment_id = c.id AND ($5 OR NOT pending)
                   ORDER BY pending DESC,
                            landed_epoch DESC NULLS LAST,
                            position DESC NULLS LAST,
                            created_at DESC, version_id DESC
                   LIMIT 1
               ) v ON TRUE
               WHERE c.target_id = $4
                 AND c.landed_epoch IS NOT NULL
                 AND ($1::bigint IS NULL
                      OR (c.landed_epoch, c.position) < ($1, $2))
               ORDER BY c.landed_epoch DESC, c.position DESC
               LIMIT $3"#,
            ce,
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
    cursor: PendingFrom,
    backward: bool,
    limit: i64,
) -> Result<Vec<Comment>, ContentError> {
    let PendingFrom {
        at, id: after_id, ..
    } = cursor;
    let (he, hp) = cursor.horizon_parts();
    let rows = if backward {
        sqlx::query_as!(
            CommentRow,
            r#"SELECT * FROM (
                   SELECT c.id, c.target_id, c.target_type, c.author_id,
                          c.l1_node_id, c.license, c.landed_epoch,
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
                                position DESC NULLS LAST,
                                created_at DESC, version_id DESC
                       LIMIT 1
                   ) v ON TRUE
                   WHERE c.target_id = $4
                     AND (c.landed_epoch IS NULL
                          OR (c.landed_epoch, c.position) > ($5::bigint, $6::bigint))
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
            he,
            hp,
        )
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as!(
            CommentRow,
            r#"SELECT c.id, c.target_id, c.target_type, c.author_id,
                      c.l1_node_id, c.license, c.landed_epoch,
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
                            position DESC NULLS LAST,
                            created_at DESC, version_id DESC
                   LIMIT 1
               ) v ON TRUE
               WHERE c.target_id = $4
                 AND (c.landed_epoch IS NULL
                      OR (c.landed_epoch, c.position) > ($5::bigint, $6::bigint))
                 AND ($1::timestamptz IS NULL
                      OR ($2::uuid IS NULL AND c.created_at < $1)
                      OR ($2 IS NOT NULL AND (c.created_at, c.id) < ($1, $2)))
               ORDER BY c.created_at DESC, c.id DESC
               LIMIT $3"#,
            at,
            after_id,
            limit,
            target_id,
            he,
            hp,
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

/// One person's comments (a profile's Comments view), whatever they
/// answer: newest-first in the thread read's own two namespaces —
/// pending entries ahead of the landed ones, which follow in landing
/// order (api-spec.md "Pagination"). `backward` serves `last`/`before`;
/// results always come back newest-first.
///
/// Its own statements rather than the thread read's with an optional
/// target: a parameter that may be NULL in the thread's `WHERE` would cost
/// the thread its index under a generic plan, the reason `merge_walk`
/// already gives for writing each direction out.
pub async fn comments_by_author(
    pool: &PgPool,
    author: Uuid,
    cursor: Option<ContentCursor>,
    backward: bool,
    limit: i64,
    include_pending: bool,
) -> Result<Listing<Comment>, ContentError> {
    let cursor = resolve_comment_cursor(pool, cursor).await?;
    merge_walk(
        cursor,
        backward,
        limit,
        include_pending,
        |c, back, n| comments_by_author_landed(pool, author, c, back, n, include_pending),
        |c, back, n| comments_by_author_pending(pool, author, c, back, n),
    )
    .await
}

/// The landed branch of [`comments_by_author`]; `include_pending` gates
/// the version lateral as it does in [`comments_landed`].
async fn comments_by_author_landed(
    pool: &PgPool,
    author: Uuid,
    cursor: Option<LandingOrder>,
    backward: bool,
    limit: i64,
    include_pending: bool,
) -> Result<Vec<Comment>, ContentError> {
    let (ce, cp) = match cursor {
        Some(c) => (Some(c.landed_epoch), Some(c.position)),
        None => (None, None),
    };
    let rows = if backward {
        sqlx::query_as!(
            CommentRow,
            r#"SELECT * FROM (
                   SELECT c.id, c.target_id, c.target_type, c.author_id,
                          c.l1_node_id, c.license, c.landed_epoch,
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
                       WHERE comment_id = c.id AND ($5 OR NOT pending)
                       ORDER BY pending DESC,
                                landed_epoch DESC NULLS LAST,
                                position DESC NULLS LAST,
                                created_at DESC, version_id DESC
                       LIMIT 1
                   ) v ON TRUE
                   WHERE c.author_id = $4
                     AND c.landed_epoch IS NOT NULL
                     AND ($1::bigint IS NULL
                          OR (c.landed_epoch, c.position) > ($1, $2))
                   ORDER BY c.landed_epoch ASC, c.position ASC
                   LIMIT $3
               ) page
               ORDER BY landed_epoch DESC, position DESC"#,
            ce,
            cp,
            limit,
            author,
            include_pending,
        )
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as!(
            CommentRow,
            r#"SELECT c.id, c.target_id, c.target_type, c.author_id,
                      c.l1_node_id, c.license, c.landed_epoch,
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
                   WHERE comment_id = c.id AND ($5 OR NOT pending)
                   ORDER BY pending DESC,
                            landed_epoch DESC NULLS LAST,
                            position DESC NULLS LAST,
                            created_at DESC, version_id DESC
                   LIMIT 1
               ) v ON TRUE
               WHERE c.author_id = $4
                 AND c.landed_epoch IS NOT NULL
                 AND ($1::bigint IS NULL
                      OR (c.landed_epoch, c.position) < ($1, $2))
               ORDER BY c.landed_epoch DESC, c.position DESC
               LIMIT $3"#,
            ce,
            cp,
            limit,
            author,
            include_pending,
        )
        .fetch_all(pool)
        .await?
    };
    Ok(rows.into_iter().map(comment_from_row).collect())
}

/// The pending branch of [`comments_by_author`]; the `(instant, id)`
/// keyset of [`comments_pending`].
async fn comments_by_author_pending(
    pool: &PgPool,
    author: Uuid,
    cursor: PendingFrom,
    backward: bool,
    limit: i64,
) -> Result<Vec<Comment>, ContentError> {
    let PendingFrom {
        at, id: after_id, ..
    } = cursor;
    let (he, hp) = cursor.horizon_parts();
    let rows = if backward {
        sqlx::query_as!(
            CommentRow,
            r#"SELECT * FROM (
                   SELECT c.id, c.target_id, c.target_type, c.author_id,
                          c.l1_node_id, c.license, c.landed_epoch,
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
                                position DESC NULLS LAST,
                                created_at DESC, version_id DESC
                       LIMIT 1
                   ) v ON TRUE
                   WHERE c.author_id = $4
                     AND (c.landed_epoch IS NULL
                          OR (c.landed_epoch, c.position) > ($5::bigint, $6::bigint))
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
            author,
            he,
            hp,
        )
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as!(
            CommentRow,
            r#"SELECT c.id, c.target_id, c.target_type, c.author_id,
                      c.l1_node_id, c.license, c.landed_epoch,
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
                            position DESC NULLS LAST,
                            created_at DESC, version_id DESC
                   LIMIT 1
               ) v ON TRUE
               WHERE c.author_id = $4
                 AND (c.landed_epoch IS NULL
                      OR (c.landed_epoch, c.position) > ($5::bigint, $6::bigint))
                 AND ($1::timestamptz IS NULL
                      OR ($2::uuid IS NULL AND c.created_at < $1)
                      OR ($2 IS NOT NULL AND (c.created_at, c.id) < ($1, $2)))
               ORDER BY c.created_at DESC, c.id DESC
               LIMIT $3"#,
            at,
            after_id,
            limit,
            author,
            he,
            hp,
        )
        .fetch_all(pool)
        .await?
    };
    Ok(rows.into_iter().map(comment_from_row).collect())
}

/// How many comments [`comments_by_author`] serves under the same filter,
/// cursor-independent; the filter restates the walk as
/// [`count_comments_for_target`] does.
pub async fn count_comments_by_author(
    pool: &PgPool,
    author: Uuid,
    include_pending: bool,
) -> Result<i64, ContentError> {
    Ok(sqlx::query_scalar!(
        r#"SELECT COUNT(*)::bigint AS "total!"
           FROM comments c
           WHERE c.author_id = $1
             AND ($2 OR c.landed_epoch IS NOT NULL)
             AND EXISTS (
                 SELECT 1 FROM comment_versions v
                 WHERE v.comment_id = c.id AND ($2 OR NOT v.pending)
             )"#,
        author,
        include_pending,
    )
    .fetch_one(pool)
    .await?)
}

/// One entry of a person's chronicle (api-spec.md `User.chronicle`): a
/// record they authored that is ordered fact, or a post or comment they
/// signed that is still settling. Every other act joins only as its
/// record, once it has landed.
#[derive(Debug, Clone)]
pub enum ChronicleEntry {
    Record(crate::mirror::RecordFull),
    Post(Post),
    Comment(Comment),
}

impl ChronicleEntry {
    /// The listing sort key, in the content listings' two namespaces: a
    /// record's key of record, a settling entry's pending key.
    pub fn sort_key(&self) -> LandingOrder {
        match self {
            Self::Record(r) => LandingOrder {
                landed_epoch: r.epoch,
                position: r.position,
            },
            Self::Post(p) => p.sort_key(),
            Self::Comment(c) => c.sort_key(),
        }
    }

    /// The entry's own id, which a pending cursor carries so the walk can
    /// find it again once it lands. A record carries none, as on the
    /// record set's own cursors.
    pub fn id(&self) -> Option<Uuid> {
        match self {
            Self::Record(_) => None,
            Self::Post(p) => Some(p.id),
            Self::Comment(c) => Some(c.id),
        }
    }
}

impl Listed for ChronicleEntry {
    fn landed_key(&self) -> Option<LandingOrder> {
        match self {
            Self::Record(_) => Some(self.sort_key()),
            Self::Post(p) => p.order,
            Self::Comment(c) => c.order,
        }
    }

    /// A record is served only at or below the horizon, so its key is its
    /// place; a post or comment is served from the settling branch, and
    /// sorts where any content row does.
    fn view_key(&self, horizon: Option<LandingOrder>) -> LandingOrder {
        match self {
            Self::Record(_) => self.sort_key(),
            Self::Post(p) => p.view_key(horizon),
            Self::Comment(c) => c.view_key(horizon),
        }
    }

    fn entry_id(&self) -> Option<Uuid> {
        self.id()
    }
}

/// A settling post or comment, keyed for the pending branch's merge.
struct Settling {
    created_at: Timestamp,
    id: Uuid,
    l1_node_id: String,
    /// The display row's landing key, once promoted.
    landed: Option<LandingOrder>,
    entry: ChronicleEntry,
}

impl Settling {
    fn key(&self) -> (Timestamp, Uuid) {
        (self.created_at, self.id)
    }

    /// The record that will mint this node: a genesis act's target is the
    /// mint of its own identifier (`mirror::genesis_records`).
    fn genesis_record(&self) -> Option<&str> {
        self.l1_node_id.strip_prefix("mint:")
    }

    /// Whether the settling branch serves this row, given where its minting
    /// record stands in the mirror. A record at or below the horizon — or
    /// any mirrored record, for a walk without one — is ordered fact the
    /// landed branch serves, so the row stays out; a record landed above
    /// the horizon leaves the row where the walk first met it. With no
    /// record mirrored, only a row still pending is settling.
    fn served(&self, mirrored: Option<LandingOrder>, horizon: Option<LandingOrder>) -> bool {
        match mirrored {
            Some(key) => horizon.is_some_and(|h| key > h),
            None => self.landed.is_none(),
        }
    }
}

/// A person's chronicle — the profile's Everything view: their records
/// in landing order, newest first, with the posts and comments they
/// signed that are still settling ahead of them, in the content
/// listings' order and their two cursor namespaces (api-spec.md
/// "Pagination"). `address` is the person's L1 address, the records'
/// author; `author` their account, the content rows' author.
/// `include_pending` false serves the records alone.
///
/// The walk reads the chronicle as of its first page, as the content
/// listings do ([`ContentCursor::horizon`]); its horizon is the newest of
/// the person's records then, so an entry that lands between two pages is
/// served exactly once.
pub async fn chronicle(
    pool: &PgPool,
    author: Uuid,
    address: &str,
    cursor: Option<ContentCursor>,
    backward: bool,
    limit: i64,
    include_pending: bool,
) -> Result<Listing<ChronicleEntry>, crate::mirror::MirrorError> {
    let cursor = resolve_chronicle_cursor(pool, cursor).await?;
    let filter = crate::mirror::RecordFilter {
        author: Some(address.to_string()),
        ..Default::default()
    };
    let filter = &filter;
    merge_walk(
        cursor,
        backward,
        limit,
        include_pending,
        |c, back, n| async move {
            let key = c.map(|o| (o.landed_epoch, o.position));
            let rows = crate::mirror::records(pool, filter, key, back, n).await?;
            Ok::<_, crate::mirror::MirrorError>(
                rows.into_iter().map(ChronicleEntry::Record).collect(),
            )
        },
        |c, back, n| chronicle_settling(pool, author, c, back, n),
    )
    .await
}

/// Where a chronicle cursor's entry sits now: a settling cursor names a
/// post or a comment, and whichever table holds its id answers.
async fn resolve_chronicle_cursor(
    pool: &PgPool,
    cursor: Option<ContentCursor>,
) -> Result<Option<ContentCursor>, ContentError> {
    let as_post = resolve_post_cursor(pool, cursor).await?;
    if as_post.map(|c| c.order) != cursor.map(|c| c.order) {
        return Ok(as_post);
    }
    resolve_comment_cursor(pool, cursor).await
}

/// The chronicle's pending branch: the person's settling posts and
/// comments, merged on the one `(authoring instant, id)` keyset both
/// tables page on, newest first.
///
/// A settling row whose minting record the landed branch serves is left
/// out ([`Settling::served`]): its record is ordered fact, and the display
/// row only lags behind it until the landing pass promotes it
/// (`staged::promote_landed` runs after the epoch is mirrored). Left in,
/// one page would carry the same post twice. Leaving rows out can cut a
/// batch short, so the branch reads on from where the batch ended until
/// it has its `limit` or the settling rows run out — a short branch is
/// what tells the walk to continue into the landed one.
async fn chronicle_settling(
    pool: &PgPool,
    author: Uuid,
    cursor: PendingFrom,
    backward: bool,
    limit: i64,
) -> Result<Vec<ChronicleEntry>, crate::mirror::MirrorError> {
    let mut kept: Vec<Settling> = Vec::new();
    let mut from = cursor;
    while (kept.len() as i64) < limit {
        let ask = limit - kept.len() as i64;
        let (batch, exhausted) = settling_batch(pool, author, from, backward, ask).await?;
        let edge = if backward {
            batch.first()
        } else {
            batch.last()
        };
        let Some(edge) = edge.map(Settling::key) else {
            break;
        };
        let minting: Vec<String> = batch
            .iter()
            .filter_map(|s| s.genesis_record().map(str::to_string))
            .collect();
        let mirrored = crate::mirror::record_keys(pool, &minting).await?;
        let fresh = batch.into_iter().filter(|s| {
            let key = s
                .genesis_record()
                .and_then(|r| mirrored.get(r))
                .map(|&(landed_epoch, position)| LandingOrder {
                    landed_epoch,
                    position,
                });
            s.served(key, cursor.horizon)
        });
        if backward {
            let mut head: Vec<Settling> = fresh.collect();
            head.append(&mut kept);
            kept = head;
        } else {
            kept.extend(fresh);
        }
        if exhausted {
            break;
        }
        from = PendingFrom {
            at: Some(edge.0),
            id: Some(edge.1),
            ..cursor
        };
    }
    Ok(kept.into_iter().map(|s| s.entry).collect())
}

/// One read of both settling tables from `cursor`: up to `limit` entries,
/// newest first, the ones nearest the cursor in the walk's direction —
/// and whether both tables ran out before `limit`.
async fn settling_batch(
    pool: &PgPool,
    author: Uuid,
    cursor: PendingFrom,
    backward: bool,
    limit: i64,
) -> Result<(Vec<Settling>, bool), ContentError> {
    let posts = list_posts_pending(pool, Some(author), cursor, backward, limit).await?;
    let comments = comments_by_author_pending(pool, author, cursor, backward, limit).await?;
    let mut batch: Vec<Settling> = posts
        .into_iter()
        .map(|p| Settling {
            created_at: p.created_at,
            id: p.id,
            l1_node_id: p.l1_node_id.clone(),
            landed: p.order,
            entry: ChronicleEntry::Post(p),
        })
        .chain(comments.into_iter().map(|c| Settling {
            created_at: c.created_at,
            id: c.id,
            l1_node_id: c.l1_node_id.clone(),
            landed: c.order,
            entry: ChronicleEntry::Comment(c),
        }))
        .collect();
    batch.sort_by_key(|s| std::cmp::Reverse(s.key()));
    let exhausted = (batch.len() as i64) < limit;
    Ok((nearest(batch, backward, limit), exhausted))
}

/// The `limit` entries of a newest-first list nearest the cursor: its
/// head on a forward walk, its tail on a backward one.
fn nearest<T>(mut rows: Vec<T>, backward: bool, limit: i64) -> Vec<T> {
    let keep = usize::try_from(limit).unwrap_or(0);
    if rows.len() > keep {
        if backward {
            let start = rows.len() - keep;
            rows = rows.split_off(start);
        } else {
            rows.truncate(keep);
        }
    }
    rows
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

/// The post each comment's thread hangs under, for every comment among
/// `ids` whose chain of targets ends at a post, in one round trip.
///
/// A reply targets a comment, and reply depth is uncapped
/// (comment.md), so the walk climbs the target chain to its post rather
/// than a fixed number of levels. Answers `(comment, post)` pairs; a
/// comment whose chain ends anywhere else is absent.
pub async fn thread_posts(pool: &PgPool, ids: &[Uuid]) -> Result<Vec<(Uuid, Uuid)>, ContentError> {
    let rows = sqlx::query!(
        r#"WITH RECURSIVE up(origin, target_id, target_type) AS (
               SELECT c.id, c.target_id, c.target_type
               FROM comments c WHERE c.id = ANY($1)
               UNION ALL
               SELECT up.origin, c.target_id, c.target_type
               FROM up JOIN comments c
                 ON up.target_type = 'comment' AND c.id = up.target_id
           )
           SELECT origin AS "comment!", target_id AS "post!"
           FROM up WHERE target_type = 'post'"#,
        ids,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|r| (r.comment, r.post)).collect())
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
            position: 0,
        }
    }

    fn at(micros: i64) -> Timestamp {
        chrono::DateTime::from_timestamp_micros(micros).expect("in range")
    }

    /// A walk's stand-in row: the number is its landing epoch.
    impl Listed for i32 {
        fn landed_key(&self) -> Option<LandingOrder> {
            Some(landed(i64::from(*self)))
        }

        fn view_key(&self, _: Option<LandingOrder>) -> LandingOrder {
            landed(i64::from(*self))
        }

        fn entry_id(&self) -> Option<Uuid> {
            None
        }
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

    /// The table's CHECK admits all landing coordinates or none, so a row
    /// carrying part of a position reads as pending rather than as a
    /// position with holes in it.
    ///
    /// A row holding part of a landing position holds no position at all.
    /// ´claim:content:a-partial-position-is-no-position´
    #[test]
    fn a_partial_position_is_no_position() {
        assert_eq!(landing_order(Some(1), Some(3)).map(|o| o.position), Some(3));
        assert_eq!(landing_order(Some(1), None), None);
        assert_eq!(landing_order(None, Some(3)), None);
        assert_eq!(landing_order(None, None), None);
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
            horizon: None,
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
                ..pending
            })),
            None
        );
        assert_eq!(movable(None), None);
    }

    /// Under a horizon the walk reads the listing as of its first page, so
    /// a pending cursor's entry keeps its place and is never re-read.
    ///
    /// A pending cursor carrying a horizon is never re-read.
    /// ´claim:content:a-cursor-under-a-horizon-is-never-re-read´
    #[test]
    fn a_cursor_under_a_horizon_is_never_re_read() {
        let cursor = ContentCursor {
            order: LandingOrder::pending_at(at(9)),
            id: Some(Uuid::from_u128(1)),
            horizon: Some(landed(3)),
        };
        assert_eq!(movable(Some(cursor)), None);
    }

    /// A content row reads in the landed namespace only if it had landed by
    /// the horizon; one landed above it keeps its pending key. Without a
    /// horizon the key is the row's sort key.
    ///
    /// A row landed above the walk's horizon keeps its pending key; one at or below it reads its landing key.
    /// ´claim:content:a-row-landed-above-the-horizon-keeps-its-pending-key´
    #[test]
    fn a_row_landed_above_the_horizon_keeps_its_pending_key() {
        let pending = LandingOrder::pending_at(at(5));
        assert_eq!(content_view_key(None, at(5), Some(landed(3))), pending);
        assert_eq!(
            content_view_key(Some(landed(4)), at(5), Some(landed(3))),
            pending
        );
        assert_eq!(
            content_view_key(Some(landed(3)), at(5), Some(landed(3))),
            landed(3)
        );
        assert_eq!(content_view_key(Some(landed(4)), at(5), None), landed(4));
        assert_eq!(content_view_key(None, at(5), None), pending);
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
            horizon: None,
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
            horizon: None,
        };
        let keyset = |from: PendingFrom| (from.at, from.id);
        assert_eq!(
            keyset(pending_from(Some(pending), None)),
            (Some(at(9)), Some(id))
        );
        assert_eq!(
            keyset(pending_from(
                Some(ContentCursor {
                    order: landed(1),
                    ..pending
                }),
                None
            )),
            (None, None)
        );
        assert_eq!(keyset(pending_from(None, None)), (None, None));
    }

    type LandedAsk = (Option<LandingOrder>, bool, i64);
    type PendingAsk = (PendingFrom, bool, i64);

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
        let (listing, calls) = walk_listing(
            cursor,
            backward,
            limit,
            include_pending,
            pending_rows,
            landed_rows,
        )
        .await;
        (listing.items, calls)
    }

    async fn walk_listing(
        cursor: Option<ContentCursor>,
        backward: bool,
        limit: i64,
        include_pending: bool,
        pending_rows: Vec<i32>,
        landed_rows: Vec<i32>,
    ) -> (Listing<i32>, Calls) {
        let calls = std::cell::RefCell::new(Calls::default());
        let out =
            merge_walk(
                cursor,
                backward,
                limit,
                include_pending,
                |c, back, n| {
                    calls.borrow_mut().landed.push((c, back, n));
                    let rows = landed_rows.clone();
                    async move {
                        Ok::<_, ContentError>(rows.into_iter().take(n.max(0) as usize).collect())
                    }
                },
                |c, back, n| {
                    calls.borrow_mut().pending.push((c, back, n));
                    let rows = pending_rows.clone();
                    async move {
                        Ok::<_, ContentError>(rows.into_iter().take(n.max(0) as usize).collect())
                    }
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
                horizon: None,
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
                horizon: None,
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

    /// A walk's first page learns its horizon from the newest landed row
    /// it read, at no extra ask; a first page the pending branch filled
    /// asks the landed branch for its one newest row; a listing with no
    /// landed row has the empty horizon.
    ///
    /// A walk's first page fixes its horizon from the newest landed row, asking for it only when the page read none.
    /// ´claim:content:the-first-page-fixes-the-walks-horizon´
    #[tokio::test]
    async fn the_first_page_fixes_the_walks_horizon() {
        let (read, calls) = walk_listing(None, false, 3, true, vec![9], vec![6, 5]).await;
        assert_eq!(read.horizon, Some(landed(6)));
        assert_eq!(calls.landed.len(), 1, "learnt from the page's own rows");

        let (full, calls) = walk_listing(None, false, 1, true, vec![9, 8], vec![6, 5]).await;
        assert_eq!(full.items, vec![9]);
        assert_eq!(full.horizon, Some(landed(6)));
        assert_eq!(calls.landed, vec![(None, false, 1)], "one ask for the newest");

        let (empty, _) = walk_listing(None, false, 3, true, vec![9], vec![]).await;
        assert_eq!(empty.horizon, Some(EMPTY_HORIZON));

        let (back, calls) = walk_listing(None, true, 2, true, vec![9], vec![6, 5]).await;
        assert_eq!(back.horizon, Some(landed(6)));
        assert_eq!(calls.landed.len(), 2, "a full backward page asks once more");

        let (settled, _) = walk_listing(None, false, 3, false, vec![], vec![6, 5]).await;
        assert_eq!(settled.horizon, None, "a settled read keeps none");
    }

    /// Under a horizon the landed branch is read as of it: forward from a
    /// pending cursor it starts just above the horizon, and backward it
    /// keeps only the rows at or below it. The pending branch is told the
    /// horizon so it reads the rows landed above it.
    ///
    /// Under a horizon the landed branch serves only what had landed by it, and the pending branch reads the rest.
    /// ´claim:content:a-horizon-splits-the-two-branches´
    #[tokio::test]
    async fn a_horizon_splits_the_two_branches() {
        let horizon = Some(LandingOrder {
            landed_epoch: 5,
            position: 0,
        });
        let pending = ContentCursor {
            order: LandingOrder::pending_at(at(9)),
            id: None,
            horizon,
        };
        let (_, calls) = walk(Some(pending), false, 3, true, vec![], vec![5, 4]).await;
        assert_eq!(calls.pending[0].0.horizon, horizon);
        assert_eq!(
            calls.landed[0].0,
            Some(LandingOrder {
                landed_epoch: 5,
                position: 1,
            }),
            "the horizon itself is admitted"
        );

        let below = ContentCursor {
            order: landed(2),
            ..pending
        };
        let (out, calls) = walk(Some(below), true, 4, true, vec![1], vec![7, 5, 3]).await;
        assert_eq!(out, vec![1, 5, 3], "the row landed above the horizon is not served here");
        assert_eq!(calls.pending[0].2, 2);
    }
}
