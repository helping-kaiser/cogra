//! ´mod:module:bookmarks´
//!
//! The Saved list (data-model.md "Personal frontend state"; api-spec.md
//! `User.bookmarks`, `setBookmark`, `removeBookmark`): `user_bookmarks`,
//! its two writers and its readers.
//!
//! # Once per node, removable
//!
//! The primary key `(user_id, content_id)` is the once-per-node law: a
//! save is `ON CONFLICT DO NOTHING`, so saving a kept node changes
//! nothing and keeps its first time. Unlike the seen-list, a bookmark is
//! genuinely deleted on unsave — private operational state carries no
//! append-only history (api-spec.md "Private viewer state").
//!
//! # What is saveable
//!
//! A row's `kind` is read from the L2 registries at write time — `posts`,
//! `comments`, user-kind `actors` — never from the client. A keyless
//! applicant is still a user-kind actor, so their profile is saveable;
//! a topic is not (Saved holds posts, comments and people).
//!
//! # The read narrows once
//!
//! A row is served only while its thing still resolves: a pending write
//! that never landed is deleted from its registry, and the row behind it
//! is skipped. Nothing else narrows — a removed or redacted thing, a
//! deleted account and a hidden actor's things all keep their place,
//! because a save is a deliberate keep and Saved is not a feed.

use sqlx::PgPool;
use uuid::Uuid;

type Timestamp = chrono::DateTime<chrono::Utc>;

/// One kept node, as the Saved list serves it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Bookmark {
    pub content_id: Uuid,
    pub kind: String,
    pub bookmarked_at: Timestamp,
}

/// A keyset position on the Saved list: `(bookmarked_at, content_id)`,
/// both descending.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BookmarkCursor {
    pub bookmarked_at: Timestamp,
    pub content_id: Uuid,
}

impl Bookmark {
    pub fn cursor(&self) -> BookmarkCursor {
        BookmarkCursor {
            bookmarked_at: self.bookmarked_at,
            content_id: self.content_id,
        }
    }
}

/// What a save of one id came to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SaveOutcome {
    /// The node is kept — newly, or as it already stood.
    Kept(Bookmark),
    /// The id names a node Saved does not hold (a topic).
    NotSaveable,
    /// The id names nothing at all.
    Unknown,
}

/// Keeps `content_id` on `viewer`'s Saved list, stamped `at` (an Undo's
/// restored time) or now. A node already kept is left as it stands and
/// its edge returned, so a retry or a second device changes nothing.
pub async fn set_bookmark(
    pool: &PgPool,
    viewer: Uuid,
    content_id: Uuid,
    at: Option<Timestamp>,
) -> Result<SaveOutcome, sqlx::Error> {
    let inserted = sqlx::query_as!(
        Bookmark,
        r#"INSERT INTO user_bookmarks (user_id, content_id, kind, bookmarked_at)
           SELECT $1, $2, k.kind, COALESCE($3, NOW())
           FROM (
               SELECT 'post' AS kind FROM posts WHERE id = $2
               UNION ALL
               SELECT 'comment' FROM comments WHERE id = $2
               UNION ALL
               SELECT 'user' FROM actors WHERE id = $2 AND kind = 'user'
               LIMIT 1
           ) k
           ON CONFLICT (user_id, content_id) DO NOTHING
           RETURNING content_id, kind, bookmarked_at"#,
        viewer,
        content_id,
        at,
    )
    .fetch_optional(pool)
    .await?;
    if let Some(bookmark) = inserted {
        return Ok(SaveOutcome::Kept(bookmark));
    }
    if let Some(bookmark) = bookmark_of(pool, viewer, content_id).await? {
        return Ok(SaveOutcome::Kept(bookmark));
    }
    let named = sqlx::query_scalar!(
        r#"SELECT EXISTS (SELECT 1 FROM hashtags WHERE id = $1)
               OR EXISTS (SELECT 1 FROM actors WHERE id = $1) AS "named!""#,
        content_id,
    )
    .fetch_one(pool)
    .await?;
    Ok(if named {
        SaveOutcome::NotSaveable
    } else {
        SaveOutcome::Unknown
    })
}

/// Drops `content_id` from `viewer`'s Saved list — a genuine delete.
/// Answers whether a row went; dropping a node not kept is no fault.
pub async fn remove_bookmark(
    pool: &PgPool,
    viewer: Uuid,
    content_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let removed = sqlx::query!(
        "DELETE FROM user_bookmarks WHERE user_id = $1 AND content_id = $2",
        viewer,
        content_id,
    )
    .execute(pool)
    .await?
    .rows_affected();
    Ok(removed > 0)
}

/// The viewer's bookmark on one node, if kept.
pub async fn bookmark_of(
    pool: &PgPool,
    viewer: Uuid,
    content_id: Uuid,
) -> Result<Option<Bookmark>, sqlx::Error> {
    sqlx::query_as!(
        Bookmark,
        "SELECT content_id, kind, bookmarked_at FROM user_bookmarks
         WHERE user_id = $1 AND content_id = $2",
        viewer,
        content_id,
    )
    .fetch_optional(pool)
    .await
}

/// When each `(viewer, node)` pair was saved, for the pairs that are
/// kept — the batched read behind every menu's Save / Unsave row. One
/// query whatever the batch, so a page of cards costs one round trip.
pub async fn bookmarked_at_many(
    pool: &PgPool,
    pairs: &[(Uuid, Uuid)],
) -> Result<Vec<(Uuid, Uuid, Timestamp)>, sqlx::Error> {
    if pairs.is_empty() {
        return Ok(Vec::new());
    }
    let (viewers, ids): (Vec<Uuid>, Vec<Uuid>) = pairs.iter().copied().unzip();
    let rows = sqlx::query!(
        r#"SELECT b.user_id, b.content_id, b.bookmarked_at
           FROM user_bookmarks b
           JOIN unnest($1::uuid[], $2::uuid[]) AS k(user_id, content_id)
             ON b.user_id = k.user_id AND b.content_id = k.content_id"#,
        &viewers,
        &ids,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| (r.user_id, r.content_id, r.bookmarked_at))
        .collect())
}

/// The kinds a Saved list holds, as its rows name them.
pub const KINDS: [&str; 3] = ["user", "post", "comment"];

/// Every kind a Saved list holds — the read that narrows by none.
pub fn every_kind() -> Vec<String> {
    KINDS.iter().map(|kind| kind.to_string()).collect()
}

/// One page of `viewer`'s Saved list, newest first by save time, of the
/// `kinds` given ([`KINDS`] names them). Walking forward reads past
/// `cursor` toward older saves; walking backward reads toward newer ones
/// and returns them in the same newest-first order.
pub async fn bookmarks(
    pool: &PgPool,
    viewer: Uuid,
    kinds: &[String],
    cursor: Option<BookmarkCursor>,
    backward: bool,
    limit: i64,
) -> Result<Vec<Bookmark>, sqlx::Error> {
    let (at, id) = match cursor {
        Some(c) => (Some(c.bookmarked_at), Some(c.content_id)),
        None => (None, None),
    };
    if backward {
        let mut rows = sqlx::query_as!(
            Bookmark,
            r#"SELECT b.content_id, b.kind, b.bookmarked_at
               FROM user_bookmarks b
               WHERE b.user_id = $1
                 AND b.kind = ANY($5)
                 AND ($2::timestamptz IS NULL
                      OR (b.bookmarked_at, b.content_id) > ($2, $3::uuid))
                 AND CASE b.kind
                     WHEN 'post' THEN EXISTS (
                         SELECT 1 FROM posts p WHERE p.id = b.content_id)
                     WHEN 'comment' THEN EXISTS (
                         SELECT 1 FROM comments c WHERE c.id = b.content_id)
                     WHEN 'user' THEN EXISTS (
                         SELECT 1 FROM actors a WHERE a.id = b.content_id)
                     ELSE FALSE
                 END
               ORDER BY b.bookmarked_at ASC, b.content_id ASC
               LIMIT $4"#,
            viewer,
            at,
            id,
            limit,
            kinds,
        )
        .fetch_all(pool)
        .await?;
        rows.reverse();
        Ok(rows)
    } else {
        sqlx::query_as!(
            Bookmark,
            r#"SELECT b.content_id, b.kind, b.bookmarked_at
               FROM user_bookmarks b
               WHERE b.user_id = $1
                 AND b.kind = ANY($5)
                 AND ($2::timestamptz IS NULL
                      OR (b.bookmarked_at, b.content_id) < ($2, $3::uuid))
                 AND CASE b.kind
                     WHEN 'post' THEN EXISTS (
                         SELECT 1 FROM posts p WHERE p.id = b.content_id)
                     WHEN 'comment' THEN EXISTS (
                         SELECT 1 FROM comments c WHERE c.id = b.content_id)
                     WHEN 'user' THEN EXISTS (
                         SELECT 1 FROM actors a WHERE a.id = b.content_id)
                     ELSE FALSE
                 END
               ORDER BY b.bookmarked_at DESC, b.content_id DESC
               LIMIT $4"#,
            viewer,
            at,
            id,
            limit,
            kinds,
        )
        .fetch_all(pool)
        .await
    }
}

/// A keyset position on a narrowed Saved list: section ascending, then
/// `(bookmarked_at, content_id)` descending — the order the search
/// matcher serves a Saved list in (`search::Window::list`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SavedMatchCursor {
    pub section: i32,
    pub bookmarked_at: Timestamp,
    pub content_id: Uuid,
}

impl SavedMatchCursor {
    /// Where `hit`, served from a Saved list, stands.
    pub fn of_hit(hit: &crate::search::SearchHit) -> Self {
        Self {
            section: crate::search::section_of(hit.tier),
            bookmarked_at: hit.created_at,
            content_id: hit.node_id,
        }
    }

    /// The position as the matcher's own keyset reads it: a Saved list's
    /// tier is its section's first.
    pub fn as_search_cursor(self) -> crate::search::SearchCursor {
        crate::search::SearchCursor {
            tier: 2 * self.section,
            created_at: self.bookmarked_at,
            node_id: self.content_id,
        }
    }
}

/// How many entries [`bookmarks`] serves across every page — the same
/// predicate, no cursor.
pub async fn count_bookmarks(
    pool: &PgPool,
    viewer: Uuid,
    kinds: &[String],
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "n!"
           FROM user_bookmarks b
           WHERE b.user_id = $1
             AND b.kind = ANY($2)
             AND CASE b.kind
                 WHEN 'post' THEN EXISTS (
                     SELECT 1 FROM posts p WHERE p.id = b.content_id)
                 WHEN 'comment' THEN EXISTS (
                     SELECT 1 FROM comments c WHERE c.id = b.content_id)
                 WHEN 'user' THEN EXISTS (
                     SELECT 1 FROM actors a WHERE a.id = b.content_id)
                 ELSE FALSE
             END"#,
        viewer,
        kinds,
    )
    .fetch_one(pool)
    .await
}
