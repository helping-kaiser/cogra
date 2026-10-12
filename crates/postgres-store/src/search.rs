//! ´mod:module:search´
//!
//! The store side of the one search matcher (api-spec.md "Search";
//! data-model.md "Search index"): the match read over the `search_index`
//! projection.
//!
//! # Nothing here writes the projection
//!
//! The database maintains it: a row-level trigger on every source of an
//! indexed field — `actors`, `actor_profile_versions`, `posts`,
//! `post_versions`, `hashtags` — re-derives the affected node's rows in
//! the writing transaction (migration `search_index_trigger`). No store
//! function carries an index duty, so no writer can forget one and leave
//! redacted or removed content findable.
//!
//! # One matcher, two consumers
//!
//! `search` and the reference finder both read [`find`]; neither grows a
//! second predicate. What differs between them is passed in
//! [`MatchQuery`]: the kinds served, the seen-list exclusion, and the
//! finder's narrowing to what `prepareReference` accepts.

use sqlx::PgPool;
use uuid::Uuid;

type Timestamp = chrono::DateTime<chrono::Utc>;

/// One match request over the index. The text fields are built by the
/// API's matcher; nothing here parses a query.
#[derive(Debug, Clone)]
pub struct MatchQuery {
    /// The query text as typed, trimmed: compared case-insensitively for
    /// the exact-match tier.
    pub text: String,
    /// The text as a `LIKE` pattern body — metacharacters escaped with
    /// `\`, no wildcards — matched as a substring of a name-class field.
    pub like_body: String,
    /// The title query in `to_tsquery` syntax over the `simple`
    /// configuration, or None when the text carries no word.
    pub title_query: Option<String>,
    /// The index kinds served (`user`, `post`, `hashtag`). Never empty:
    /// a request that serves nothing does not reach the store.
    pub kinds: Vec<String>,
    /// Drop nodes on this account's seen-list (`user_view_log`).
    pub exclude_seen_by: Option<Uuid>,
    /// Serve only users with a realization address — the finder's
    /// narrowing: a keyless account fronts no Profile to cite.
    pub keyed_users_only: bool,
}

/// One matched node. `tier` is 0 when an indexed field equals the text
/// case-insensitively, 1 for any other match.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchHit {
    pub node_id: Uuid,
    pub kind: String,
    pub tier: i32,
    pub created_at: Timestamp,
    /// The indexed value of a topic — its canonical name, which is all a
    /// `Hashtag` is. None for the other kinds.
    pub name: Option<String>,
}

/// A position in the match order: tier ascending, then newest first,
/// then id descending.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SearchCursor {
    pub tier: i32,
    pub created_at: Timestamp,
    pub node_id: Uuid,
}

impl SearchHit {
    pub fn cursor(&self) -> SearchCursor {
        SearchCursor {
            tier: self.tier,
            created_at: self.created_at,
            node_id: self.node_id,
        }
    }
}

/// One page of matches, in display order (tier, then newest first),
/// whichever way the walk ran. `cursor` is exclusive; `backward` walks
/// toward the head of the order. Fetch `limit + 1` to learn whether
/// another page exists.
///
/// The two directions are two statements, as the listings are
/// (`content::merge_walk`): a parameterised sort direction is an
/// expression the planner cannot match to an order.
pub async fn find(
    pool: &PgPool,
    q: &MatchQuery,
    cursor: Option<SearchCursor>,
    backward: bool,
    limit: i64,
) -> Result<Vec<SearchHit>, sqlx::Error> {
    let (tier, at, id) = match cursor {
        Some(c) => (Some(c.tier), Some(c.created_at), Some(c.node_id)),
        None => (None, None, None),
    };
    if backward {
        let mut rows = sqlx::query_as!(
            SearchHit,
            r#"WITH hits AS (
                   SELECT s.node_id, s.kind, s.created_at,
                          MIN(CASE WHEN s.folded = lower($1) THEN 0 ELSE 1 END) AS tier,
                          MIN(s.value) FILTER (WHERE s.kind = 'hashtag') AS name
                   FROM search_index s
                   WHERE s.kind = ANY($4)
                     AND ((s.field <> 'title' AND s.folded LIKE '%' || lower($2) || '%')
                       OR (s.field = 'title' AND s.words @@ to_tsquery('simple', $3)))
                     AND ($5::uuid IS NULL OR NOT EXISTS (
                         SELECT 1 FROM user_view_log l
                         WHERE l.user_id = $5 AND l.content_id = s.node_id))
                     AND (NOT $6 OR s.kind <> 'user' OR EXISTS (
                         SELECT 1 FROM actors a
                         WHERE a.id = s.node_id AND a.realization_address IS NOT NULL))
                   GROUP BY s.node_id, s.kind, s.created_at
               )
               SELECT node_id AS "node_id!", kind AS "kind!",
                      tier AS "tier!", created_at AS "created_at!", name
               FROM hits
               WHERE $7::int IS NULL
                  OR tier < $7
                  OR (tier = $7 AND (created_at, node_id) > ($8::timestamptz, $9::uuid))
               ORDER BY tier DESC, created_at ASC, node_id ASC
               LIMIT $10"#,
            q.text,
            q.like_body,
            q.title_query,
            &q.kinds,
            q.exclude_seen_by,
            q.keyed_users_only,
            tier,
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
            SearchHit,
            r#"WITH hits AS (
                   SELECT s.node_id, s.kind, s.created_at,
                          MIN(CASE WHEN s.folded = lower($1) THEN 0 ELSE 1 END) AS tier,
                          MIN(s.value) FILTER (WHERE s.kind = 'hashtag') AS name
                   FROM search_index s
                   WHERE s.kind = ANY($4)
                     AND ((s.field <> 'title' AND s.folded LIKE '%' || lower($2) || '%')
                       OR (s.field = 'title' AND s.words @@ to_tsquery('simple', $3)))
                     AND ($5::uuid IS NULL OR NOT EXISTS (
                         SELECT 1 FROM user_view_log l
                         WHERE l.user_id = $5 AND l.content_id = s.node_id))
                     AND (NOT $6 OR s.kind <> 'user' OR EXISTS (
                         SELECT 1 FROM actors a
                         WHERE a.id = s.node_id AND a.realization_address IS NOT NULL))
                   GROUP BY s.node_id, s.kind, s.created_at
               )
               SELECT node_id AS "node_id!", kind AS "kind!",
                      tier AS "tier!", created_at AS "created_at!", name
               FROM hits
               WHERE $7::int IS NULL
                  OR tier > $7
                  OR (tier = $7 AND (created_at, node_id) < ($8::timestamptz, $9::uuid))
               ORDER BY tier ASC, created_at DESC, node_id DESC
               LIMIT $10"#,
            q.text,
            q.like_body,
            q.title_query,
            &q.kinds,
            q.exclude_seen_by,
            q.keyed_users_only,
            tier,
            at,
            id,
            limit,
        )
        .fetch_all(pool)
        .await
    }
}

/// How many nodes the request matches in total, across every page —
/// counted under exactly the predicate [`find`] pages over.
pub async fn count(pool: &PgPool, q: &MatchQuery) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT COUNT(DISTINCT s.node_id) AS "count!"
           FROM search_index s
           WHERE s.kind = ANY($3)
             AND ((s.field <> 'title' AND s.folded LIKE '%' || lower($1) || '%')
               OR (s.field = 'title' AND s.words @@ to_tsquery('simple', $2)))
             AND ($4::uuid IS NULL OR NOT EXISTS (
                 SELECT 1 FROM user_view_log l
                 WHERE l.user_id = $4 AND l.content_id = s.node_id))
             AND (NOT $5 OR s.kind <> 'user' OR EXISTS (
                 SELECT 1 FROM actors a
                 WHERE a.id = s.node_id AND a.realization_address IS NOT NULL))"#,
        q.like_body,
        q.title_query,
        &q.kinds,
        q.exclude_seen_by,
        q.keyed_users_only,
    )
    .fetch_one(pool)
    .await
}
