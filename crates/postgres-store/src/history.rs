//! ´mod:module:history´
//!
//! The seen-list (data-model.md "Personal frontend state";
//! feed-ranking.md §9.4): `user_view_log`, the one writer `markSeen` and
//! the reader `User.viewHistory`. A list narrowed by a query is served by
//! the one search matcher confined to the seen-list
//! (`search::ReaderList::History`), which applies the same narrowings.
//!
//! # Append-once by construction
//!
//! The primary key `(user_id, content_id)` is History's "first seeing
//! only" law: a write is `ON CONFLICT DO NOTHING`, so re-seeing never
//! counts, never moves an entry and never stands it twice. Nothing here
//! deletes a row — the list has no clear and no per-item remove
//! (api-spec.md "Private viewer state").
//!
//! # What is seeable
//!
//! A row's `kind` is read from the L2 registries at write time — `posts`,
//! `comments`, user-kind `actors`, `hashtags` — never from the client.
//! An id in none of them names nothing seeable and is skipped. A keyless
//! applicant is still a user-kind actor, so their profile is seeable.
//!
//! # The read's three narrowings
//!
//! A row is served only while its thing still resolves (a pending write
//! that never landed is deleted from its registry, and the row behind it
//! is skipped), and while its author is not on the viewer's hidden list
//! (posts and comments only — a hidden account's own profile stays,
//! History.md). Removal is NOT a narrowing: a redacted thing keeps its
//! registry row, so it keeps its place.

use sqlx::PgPool;
use uuid::Uuid;

type Timestamp = chrono::DateTime<chrono::Utc>;

/// The kinds the seen-list holds, as its `kind` column spells them.
pub const KINDS: [&str; 4] = ["post", "comment", "user", "hashtag"];

/// One seen-list entry, as the read serves it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SeenEntry {
    pub content_id: Uuid,
    pub kind: String,
    pub first_seen_at: Timestamp,
    /// The topic's name, for a `hashtag` entry; None otherwise.
    pub name: Option<String>,
}

/// A keyset position on the seen-list: `(first_seen_at, content_id)`,
/// both descending.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HistoryCursor {
    pub first_seen_at: Timestamp,
    pub content_id: Uuid,
}

impl SeenEntry {
    pub fn cursor(&self) -> HistoryCursor {
        HistoryCursor {
            first_seen_at: self.first_seen_at,
            content_id: self.content_id,
        }
    }
}

/// Records first seeings for `viewer`, in the order given: the n-th id
/// is stamped `transaction_timestamp() + n µs`, so a batch reads back in
/// the order it was seen and the keyset never orders a flush by UUID.
/// Ids already on the list, and ids naming nothing seeable, write
/// nothing. `ids` must carry no duplicates — the caller keeps each id's
/// first position. Answers how many entries were written.
pub async fn mark_seen(pool: &PgPool, viewer: Uuid, ids: &[Uuid]) -> Result<u64, sqlx::Error> {
    if ids.is_empty() {
        return Ok(0);
    }
    let written = sqlx::query!(
        r#"INSERT INTO user_view_log (user_id, content_id, kind, first_seen_at)
           SELECT $1, n.id, k.kind,
                  transaction_timestamp() + n.ord * INTERVAL '1 microsecond'
           FROM unnest($2::uuid[]) WITH ORDINALITY AS n(id, ord)
           CROSS JOIN LATERAL (
               SELECT 'post' AS kind FROM posts WHERE id = n.id
               UNION ALL
               SELECT 'comment' FROM comments WHERE id = n.id
               UNION ALL
               SELECT 'user' FROM actors WHERE id = n.id AND kind = 'user'
               UNION ALL
               SELECT 'hashtag' FROM hashtags WHERE id = n.id
               LIMIT 1
           ) k
           ON CONFLICT (user_id, content_id) DO NOTHING"#,
        viewer,
        ids,
    )
    .execute(pool)
    .await?
    .rows_affected();
    Ok(written)
}

/// One page of `viewer`'s seen-list over `kinds`, newest first by first
/// seeing. Walking forward reads past `cursor` toward older entries;
/// walking backward reads toward newer ones and returns them in the same
/// newest-first order.
pub async fn view_history(
    pool: &PgPool,
    viewer: Uuid,
    kinds: &[String],
    cursor: Option<HistoryCursor>,
    backward: bool,
    limit: i64,
) -> Result<Vec<SeenEntry>, sqlx::Error> {
    let (at, id) = match cursor {
        Some(c) => (Some(c.first_seen_at), Some(c.content_id)),
        None => (None, None),
    };
    if backward {
        let mut rows = sqlx::query_as!(
            SeenEntry,
            r#"SELECT l.content_id, l.kind, l.first_seen_at, t.name AS "name?"
               FROM user_view_log l
               LEFT JOIN hashtags t ON l.kind = 'hashtag' AND t.id = l.content_id
               WHERE l.user_id = $1
                 AND l.kind = ANY($2)
                 AND ($3::timestamptz IS NULL
                      OR (l.first_seen_at, l.content_id) > ($3, $4::uuid))
                 AND CASE l.kind
                     WHEN 'post' THEN EXISTS (
                         SELECT 1 FROM posts p
                         WHERE p.id = l.content_id
                           AND NOT EXISTS (SELECT 1 FROM user_hidden_actors h
                                           WHERE h.viewer_id = $1
                                             AND h.hidden_id = p.author_id))
                     WHEN 'comment' THEN EXISTS (
                         SELECT 1 FROM comments c
                         WHERE c.id = l.content_id
                           AND NOT EXISTS (SELECT 1 FROM user_hidden_actors h
                                           WHERE h.viewer_id = $1
                                             AND h.hidden_id = c.author_id))
                     WHEN 'user' THEN EXISTS (
                         SELECT 1 FROM actors a WHERE a.id = l.content_id)
                     WHEN 'hashtag' THEN t.id IS NOT NULL
                     ELSE FALSE
                 END
               ORDER BY l.first_seen_at ASC, l.content_id ASC
               LIMIT $5"#,
            viewer,
            kinds,
            at,
            id,
            limit,
        )
        .fetch_all(pool)
        .await?;
        rows.reverse();
        Ok(rows)
    } else {
        sqlx::query_as!(
            SeenEntry,
            r#"SELECT l.content_id, l.kind, l.first_seen_at, t.name AS "name?"
               FROM user_view_log l
               LEFT JOIN hashtags t ON l.kind = 'hashtag' AND t.id = l.content_id
               WHERE l.user_id = $1
                 AND l.kind = ANY($2)
                 AND ($3::timestamptz IS NULL
                      OR (l.first_seen_at, l.content_id) < ($3, $4::uuid))
                 AND CASE l.kind
                     WHEN 'post' THEN EXISTS (
                         SELECT 1 FROM posts p
                         WHERE p.id = l.content_id
                           AND NOT EXISTS (SELECT 1 FROM user_hidden_actors h
                                           WHERE h.viewer_id = $1
                                             AND h.hidden_id = p.author_id))
                     WHEN 'comment' THEN EXISTS (
                         SELECT 1 FROM comments c
                         WHERE c.id = l.content_id
                           AND NOT EXISTS (SELECT 1 FROM user_hidden_actors h
                                           WHERE h.viewer_id = $1
                                             AND h.hidden_id = c.author_id))
                     WHEN 'user' THEN EXISTS (
                         SELECT 1 FROM actors a WHERE a.id = l.content_id)
                     WHEN 'hashtag' THEN t.id IS NOT NULL
                     ELSE FALSE
                 END
               ORDER BY l.first_seen_at DESC, l.content_id DESC
               LIMIT $5"#,
            viewer,
            kinds,
            at,
            id,
            limit,
        )
        .fetch_all(pool)
        .await
    }
}

/// A keyset position on a narrowed seen-list: section ascending, then
/// `(first_seen_at, content_id)` descending — the order the search
/// matcher serves the seen-list in (`search::ReaderList::History`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HistoryMatchCursor {
    pub section: i32,
    pub first_seen_at: Timestamp,
    pub content_id: Uuid,
}

impl HistoryMatchCursor {
    /// Where `hit`, served from the seen-list, stands.
    pub fn of_hit(hit: &crate::search::SearchHit) -> Self {
        Self {
            section: crate::search::section_of(hit.tier),
            first_seen_at: hit.created_at,
            content_id: hit.node_id,
        }
    }

    /// The position as the matcher's own keyset reads it: a narrowed
    /// list's tier is its section's first.
    pub fn as_search_cursor(self) -> crate::search::SearchCursor {
        crate::search::SearchCursor {
            tier: 2 * self.section,
            created_at: self.first_seen_at,
            node_id: self.content_id,
        }
    }
}

/// How many entries [`view_history`] serves across every page — the same
/// predicate, no cursor.
pub async fn count_view_history(
    pool: &PgPool,
    viewer: Uuid,
    kinds: &[String],
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "n!"
           FROM user_view_log l
           WHERE l.user_id = $1
             AND l.kind = ANY($2)
             AND CASE l.kind
                 WHEN 'post' THEN EXISTS (
                     SELECT 1 FROM posts p
                     WHERE p.id = l.content_id
                       AND NOT EXISTS (SELECT 1 FROM user_hidden_actors h
                                       WHERE h.viewer_id = $1
                                         AND h.hidden_id = p.author_id))
                 WHEN 'comment' THEN EXISTS (
                     SELECT 1 FROM comments c
                     WHERE c.id = l.content_id
                       AND NOT EXISTS (SELECT 1 FROM user_hidden_actors h
                                       WHERE h.viewer_id = $1
                                         AND h.hidden_id = c.author_id))
                 WHEN 'user' THEN EXISTS (
                     SELECT 1 FROM actors a WHERE a.id = l.content_id)
                 WHEN 'hashtag' THEN EXISTS (
                     SELECT 1 FROM hashtags t WHERE t.id = l.content_id)
                 ELSE FALSE
             END"#,
        viewer,
        kinds,
    )
    .fetch_one(pool)
    .await
}
