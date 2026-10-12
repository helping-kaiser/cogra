//! ´mod:module:search´
//!
//! The store side of the one search matcher (api-spec.md "Search";
//! data-model.md "Search index"): the `search_index` projection's
//! maintenance and the match read over it.
//!
//! # The projection is refreshed, never patched
//!
//! Every function that writes a source of an indexed field — an actor's
//! handle, a profile version, a post version, the topic registry — calls
//! a `refresh_*` here inside its own transaction. A refresh deletes the
//! node's rows and re-derives them from the current version, so the
//! rules for "current", "untitled" and "redacted" live in one statement
//! per kind rather than in every writer. The migration's backfill is the
//! same derivation over every node.
//!
//! # One matcher, two consumers
//!
//! `search` and the reference finder both read [`find`]; neither grows a
//! second predicate. What differs between them is passed in
//! [`MatchQuery`]: the kinds served, the seen-list exclusion, and the
//! finder's narrowing to what `prepareReference` accepts.

use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

type Timestamp = chrono::DateTime<chrono::Utc>;

/// Re-derives the index rows of user actors from their handle and current
/// profile version. An actor that no longer exists, is not a user, or
/// whose current profile version is redacted ends with no rows.
pub async fn refresh_actors(conn: &mut PgConnection, ids: &[Uuid]) -> Result<(), sqlx::Error> {
    if ids.is_empty() {
        return Ok(());
    }
    sqlx::query!(
        "DELETE FROM search_index WHERE kind = 'user' AND node_id = ANY($1)",
        ids,
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!(
        "INSERT INTO search_index (node_id, field, kind, value, created_at)
         SELECT a.id, f.field, 'user', f.value, a.created_at
         FROM actors a
         LEFT JOIN LATERAL (
             SELECT display_name, redaction_reason
             FROM actor_profile_versions
             WHERE actor_id = a.id
             ORDER BY landed_epoch DESC NULLS LAST,
                      act_time DESC NULLS LAST,
                      position DESC NULLS LAST,
                      created_at DESC, version_id DESC
             LIMIT 1
         ) p ON TRUE
         CROSS JOIN LATERAL (
             VALUES ('handle', a.handle), ('display_name', p.display_name)
         ) f (field, value)
         WHERE a.id = ANY($1)
           AND a.kind = 'user'
           AND p.redaction_reason IS NULL
           AND f.value IS NOT NULL
           AND btrim(f.value) <> ''",
        ids,
    )
    .execute(&mut *conn)
    .await?;
    Ok(())
}

/// Re-derives the title rows of posts from their current version — the
/// same version the post reads serve, pending edits first. A post that no
/// longer exists, whose current version is untitled, or whose current
/// version is redacted ends with no row.
pub async fn refresh_posts(conn: &mut PgConnection, ids: &[Uuid]) -> Result<(), sqlx::Error> {
    if ids.is_empty() {
        return Ok(());
    }
    sqlx::query!(
        "DELETE FROM search_index WHERE kind = 'post' AND node_id = ANY($1)",
        ids,
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!(
        "INSERT INTO search_index (node_id, field, kind, value, author_id, created_at)
         SELECT p.id, 'title', 'post', v.title, p.author_id, p.created_at
         FROM posts p
         JOIN LATERAL (
             SELECT title, redaction_reason
             FROM post_versions
             WHERE post_id = p.id
             ORDER BY pending DESC,
                      landed_epoch DESC NULLS LAST,
                      act_time DESC NULLS LAST,
                      position DESC NULLS LAST,
                      created_at DESC, version_id DESC
             LIMIT 1
         ) v ON TRUE
         WHERE p.id = ANY($1)
           AND v.redaction_reason IS NULL
           AND v.title IS NOT NULL
           AND btrim(v.title) <> ''",
        ids,
    )
    .execute(&mut *conn)
    .await?;
    Ok(())
}

/// Indexes a registered topic by its canonical name. Registry rows are
/// never rewritten, so neither is this one.
pub async fn index_hashtag(conn: &mut PgConnection, name: &str) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO search_index (node_id, field, kind, value, created_at)
         SELECT id, 'name', 'hashtag', name, created_at
         FROM hashtags WHERE name = $1
         ON CONFLICT (node_id, field) DO NOTHING",
        name,
    )
    .execute(conn)
    .await?;
    Ok(())
}

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
