//! ´mod:module:removal´
//!
//! The display half of per-content removal (erasure.md §1; data-model.md
//! "Display-content versioning"): the tombstones a removed post or
//! comment leaves on its version rows, and the mark a reader reads off
//! them.
//!
//! A removal tombstones in two motions, both inside the transaction that
//! reduces the act they belong to:
//!
//! - **Every version row of a removed act is blanked in place** — its
//!   words, its title and description and its sensitive mark go, and its
//!   `redaction_reason` says why. The row itself stays: it keeps its
//!   place in the node's order, its landing coordinates and, for an edit
//!   still in flight, its pending mark, so the record landing over it
//!   later finds it and stamps its order onto a row that shows nothing.
//! - **The head act also appends one tombstone row**, whose `created_at`
//!   is the removal's own instant — the mark's moment, which no blanked
//!   row can carry, since each keeps the instant it was authored at. It
//!   copies the head version's landing coordinates, so over a landed head
//!   it is the current version and its empty gallery the gallery a reader
//!   gets; over a pending head it sorts below the pending row, which is
//!   blanked and still the current version until its record lands.
//!
//! Nothing is deleted. The junction rows of a blanked version stay, the
//! asset rows stay, and an asset leaves the live store only once
//! `media_live_placed` sees no unredacted placement left.
//!
//! The post and comment halves are written twice for the reason
//! `content`'s are: sqlx's macros take a string literal and nothing that
//! expands to one.

use std::collections::HashMap;

use sqlx::PgConnection;
use uuid::Uuid;

use crate::PgPool;
use crate::content::LandingOrder;

type Timestamp = chrono::DateTime<chrono::Utc>;

/// The archive and tombstone reason of a removal the author asked for
/// (retention-archive.md §1).
pub const AUTHOR_REMOVAL: &str = "user-content-removal";

/// The reason of a removal the author's account deletion swept in.
pub const ACCOUNT_REMOVAL: &str = "user-account-deletion";

/// The version rows one act owns: found by the landing coordinates of its
/// record once it landed, or by the authoring instant its rows carry
/// while it is pending. Either names the act's rows alone —
/// `(node, created_at)` is unique, and landing coordinates are a
/// record's own.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct ActRows {
    pub order: Option<LandingOrder>,
    pub instant: Option<Timestamp>,
}

impl ActRows {
    /// Whether the act owns no display row at all — a write never signed,
    /// whose payload never reached a screen.
    pub fn is_empty(&self) -> bool {
        self.order.is_none() && self.instant.is_none()
    }

    fn owns(&self, version: &CurrentVersion) -> bool {
        let by_order = self.order.is_some() && self.order == version.order;
        let by_instant = self.instant.is_some() && self.instant == Some(version.created_at);
        by_order || by_instant
    }
}

/// A node's current version row, as a removal reads it under the node's
/// lock.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CurrentVersion {
    pub version_id: i64,
    pub created_at: Timestamp,
    pub order: Option<LandingOrder>,
    pub redacted: bool,
}

/// Which table a content node's rows live in.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ContentNode {
    Post(Uuid),
    Comment(Uuid),
}

impl ContentNode {
    pub fn id(self) -> Uuid {
        match self {
            ContentNode::Post(id) | ContentNode::Comment(id) => id,
        }
    }
}

/// What one act's display tombstoning did.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Tombstoned {
    /// Version rows this call blanked.
    pub blanked: u64,
    /// This call appended the node's head tombstone: the act's row was
    /// the current version and the node was not removed before.
    pub appended: bool,
}

/// Locks a content node's entity row for the length of the caller's
/// transaction and reads its current version — None when the node has no
/// row. `FOR UPDATE` serializes removals of one node, and an edit's
/// pending row ([`lock_unremoved`] takes the same row `FOR SHARE`), so no
/// version can appear on a node between a removal's last look at it and
/// its tombstone.
pub async fn lock_node(
    conn: &mut PgConnection,
    node: ContentNode,
) -> Result<Option<CurrentVersion>, sqlx::Error> {
    let locked = match node {
        ContentNode::Post(id) => {
            sqlx::query_scalar!("SELECT id FROM posts WHERE id = $1 FOR UPDATE", id)
                .fetch_optional(&mut *conn)
                .await?
        }
        ContentNode::Comment(id) => {
            sqlx::query_scalar!("SELECT id FROM comments WHERE id = $1 FOR UPDATE", id)
                .fetch_optional(&mut *conn)
                .await?
        }
    };
    if locked.is_none() {
        return Ok(None);
    }
    current_version(conn, node).await
}

/// Locks a content node's entity row `FOR SHARE` and answers whether it
/// is removed — its current version tombstoned. An edit's pending row is
/// written under this lock, so it either lands before a removal locks
/// the node (and the removal sweeps it) or reads the removal and is
/// refused. True for a node with no row: nothing removed it, and the
/// caller's own read of the node answers for its absence.
pub async fn lock_unremoved(
    conn: &mut PgConnection,
    node: ContentNode,
) -> Result<bool, sqlx::Error> {
    let locked = match node {
        ContentNode::Post(id) => {
            sqlx::query_scalar!("SELECT id FROM posts WHERE id = $1 FOR SHARE", id)
                .fetch_optional(&mut *conn)
                .await?
        }
        ContentNode::Comment(id) => {
            sqlx::query_scalar!("SELECT id FROM comments WHERE id = $1 FOR SHARE", id)
                .fetch_optional(&mut *conn)
                .await?
        }
    };
    if locked.is_none() {
        return Ok(true);
    }
    Ok(!current_version(conn, node)
        .await?
        .is_some_and(|v| v.redacted))
}

async fn current_version(
    conn: &mut PgConnection,
    node: ContentNode,
) -> Result<Option<CurrentVersion>, sqlx::Error> {
    let row = match node {
        ContentNode::Post(id) => {
            sqlx::query_as!(
                VersionRow,
                r#"SELECT version_id, created_at, landed_epoch, act_time, position,
                          redaction_reason IS NOT NULL AS "redacted!"
                   FROM post_versions WHERE post_id = $1
                   ORDER BY pending DESC,
                            landed_epoch DESC NULLS LAST,
                            act_time DESC NULLS LAST,
                            position DESC NULLS LAST,
                            created_at DESC, version_id DESC
                   LIMIT 1"#,
                id,
            )
            .fetch_optional(&mut *conn)
            .await?
        }
        ContentNode::Comment(id) => {
            sqlx::query_as!(
                VersionRow,
                r#"SELECT version_id, created_at, landed_epoch, act_time, position,
                          redaction_reason IS NOT NULL AS "redacted!"
                   FROM comment_versions WHERE comment_id = $1
                   ORDER BY pending DESC,
                            landed_epoch DESC NULLS LAST,
                            act_time DESC NULLS LAST,
                            position DESC NULLS LAST,
                            created_at DESC, version_id DESC
                   LIMIT 1"#,
                id,
            )
            .fetch_optional(&mut *conn)
            .await?
        }
    };
    Ok(row.map(VersionRow::into_current))
}

struct VersionRow {
    version_id: i64,
    created_at: Timestamp,
    landed_epoch: Option<i64>,
    act_time: Option<i64>,
    position: Option<i64>,
    redacted: bool,
}

impl VersionRow {
    fn into_current(self) -> CurrentVersion {
        let order = match (self.landed_epoch, self.act_time, self.position) {
            (Some(landed_epoch), Some(act_time), Some(position)) => Some(LandingOrder {
                landed_epoch,
                act_time,
                position,
            }),
            _ => None,
        };
        CurrentVersion {
            version_id: self.version_id,
            created_at: self.created_at,
            order,
            redacted: self.redacted,
        }
    }
}

/// Tombstones one act's display rows, on the caller's transaction, under
/// the node lock [`lock_node`] took and with `head` the current version it
/// read: every row the act owns is blanked in place, and when the act's
/// row was the unremoved current version, the head tombstone is appended.
///
/// Idempotent: a blanked row is not touched again, and a node whose
/// current version is already a tombstone gets no second one — so a
/// retried removal neither moves the mark's moment nor stacks marks.
pub async fn tombstone_act(
    conn: &mut PgConnection,
    node: ContentNode,
    head: &CurrentVersion,
    act: &ActRows,
    reason: &str,
) -> Result<Tombstoned, sqlx::Error> {
    if act.is_empty() {
        return Ok(Tombstoned::default());
    }
    let (epoch, act_time, position) = coordinates(act.order);
    let blanked = match node {
        ContentNode::Post(id) => sqlx::query!(
            "UPDATE post_versions
             SET title = NULL, description = NULL, content = '',
                 sensitive = FALSE, sensitive_reason = NULL,
                 redaction_reason = $2
             WHERE post_id = $1 AND redaction_reason IS NULL
               AND ((landed_epoch = $3 AND act_time = $4 AND position = $5)
                    OR created_at = $6)",
            id,
            reason,
            epoch,
            act_time,
            position,
            act.instant,
        )
        .execute(&mut *conn)
        .await?
        .rows_affected(),
        ContentNode::Comment(id) => sqlx::query!(
            "UPDATE comment_versions
             SET content = '', sensitive = FALSE, sensitive_reason = NULL,
                 redaction_reason = $2
             WHERE comment_id = $1 AND redaction_reason IS NULL
               AND ((landed_epoch = $3 AND act_time = $4 AND position = $5)
                    OR created_at = $6)",
            id,
            reason,
            epoch,
            act_time,
            position,
            act.instant,
        )
        .execute(&mut *conn)
        .await?
        .rows_affected(),
    };
    let appended = !head.redacted && act.owns(head);
    if appended {
        append_tombstone(conn, node, head, reason).await?;
    }
    Ok(Tombstoned { blanked, appended })
}

fn coordinates(order: Option<LandingOrder>) -> (Option<i64>, Option<i64>, Option<i64>) {
    match order {
        Some(o) => (Some(o.landed_epoch), Some(o.act_time), Some(o.position)),
        None => (None, None, None),
    }
}

/// The head tombstone: content emptied, never pending, the head's landing
/// coordinates, and `NOW()` — the removing transaction's own instant, the
/// same one its carriage reduction stamps.
async fn append_tombstone(
    conn: &mut PgConnection,
    node: ContentNode,
    head: &CurrentVersion,
    reason: &str,
) -> Result<(), sqlx::Error> {
    let (epoch, act_time, position) = coordinates(head.order);
    match node {
        ContentNode::Post(id) => {
            sqlx::query!(
                "INSERT INTO post_versions
                     (post_id, title, description, content, redaction_reason,
                      pending, landed_epoch, act_time, position,
                      sensitive, sensitive_reason, created_at)
                 VALUES ($1, NULL, NULL, '', $2, FALSE, $3, $4, $5, FALSE, NULL, NOW())",
                id,
                reason,
                epoch,
                act_time,
                position,
            )
            .execute(&mut *conn)
            .await?;
        }
        ContentNode::Comment(id) => {
            sqlx::query!(
                "INSERT INTO comment_versions
                     (comment_id, content, redaction_reason,
                      pending, landed_epoch, act_time, position,
                      sensitive, sensitive_reason, created_at)
                 VALUES ($1, '', $2, FALSE, $3, $4, $5, FALSE, NULL, NOW())",
                id,
                reason,
                epoch,
                act_time,
                position,
            )
            .execute(&mut *conn)
            .await?;
        }
    }
    Ok(())
}

/// A removed node's mark as stored: why, and when — the head tombstone's
/// instant — plus the moment its content last changed before it, which is
/// what `updatedAt` keeps reading (a removal is no edit).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Removal {
    pub reason: String,
    pub at: Timestamp,
    pub updated_at: Option<Timestamp>,
}

/// The removal marks of the given posts, keyed by post id. A post with no
/// tombstone is absent. The caller reads a mark only off a node whose
/// current version is tombstoned; a node with only an earlier revision
/// removed carries a blanked row and no head tombstone, and is not
/// removed.
///
/// The head tombstone is the newest-instant tombstoned row: it is written
/// at the removal, after every version the node had, and no version is
/// written on a removed node after it.
pub async fn post_removals(
    pool: &PgPool,
    ids: &[Uuid],
) -> Result<HashMap<Uuid, Removal>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"SELECT t.post_id AS "post_id!", t.redaction_reason AS "reason!",
                  t.created_at AS "at!",
                  (SELECT created_at FROM post_versions
                   WHERE post_id = t.post_id AND version_id <> t.version_id
                   ORDER BY pending DESC,
                            landed_epoch DESC NULLS LAST,
                            act_time DESC NULLS LAST,
                            position DESC NULLS LAST,
                            created_at DESC, version_id DESC
                   LIMIT 1) AS updated_at
           FROM (SELECT DISTINCT ON (post_id) post_id, version_id, created_at,
                        redaction_reason
                 FROM post_versions
                 WHERE post_id = ANY($1) AND redaction_reason IS NOT NULL
                 ORDER BY post_id, created_at DESC, version_id DESC) t"#,
        ids,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| {
            (
                r.post_id,
                Removal {
                    reason: r.reason,
                    at: r.at,
                    updated_at: r.updated_at,
                },
            )
        })
        .collect())
}

/// The comment side of [`post_removals`].
pub async fn comment_removals(
    pool: &PgPool,
    ids: &[Uuid],
) -> Result<HashMap<Uuid, Removal>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"SELECT t.comment_id AS "comment_id!", t.redaction_reason AS "reason!",
                  t.created_at AS "at!",
                  (SELECT created_at FROM comment_versions
                   WHERE comment_id = t.comment_id AND version_id <> t.version_id
                   ORDER BY pending DESC,
                            landed_epoch DESC NULLS LAST,
                            act_time DESC NULLS LAST,
                            position DESC NULLS LAST,
                            created_at DESC, version_id DESC
                   LIMIT 1) AS updated_at
           FROM (SELECT DISTINCT ON (comment_id) comment_id, version_id, created_at,
                        redaction_reason
                 FROM comment_versions
                 WHERE comment_id = ANY($1) AND redaction_reason IS NOT NULL
                 ORDER BY comment_id, created_at DESC, version_id DESC) t"#,
        ids,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| {
            (
                r.comment_id,
                Removal {
                    reason: r.reason,
                    at: r.at,
                    updated_at: r.updated_at,
                },
            )
        })
        .collect())
}
