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
//! [`MatchQuery`]: the kinds served, the seen-list exclusion, the
//! finder's narrowing to what `prepareReference` accepts, and a bare
//! scope's lookup.
//!
//! # The scoped branch
//!
//! A scope with text after it — `@handle <text>`, `#tag <text>` — is a
//! content search inside the scope ([`find_scoped`]). The text matches
//! the same index: a post through its own title, a comment through its
//! thread root's title, a topic through its name. The scope narrows what
//! may match: one author's work, or what carries one topic.
//!
//! "Carries" is the tag page's own set: the current-topics fold over the
//! content-intrinsic channel (`topics::TagChannel::AuthorOwned`) — a
//! claim whose author is the content's own author, newest record per
//! (author, content, Type) bundle, relevance 0 read as withdrawn. The
//! fold is the one `topics::tagged_with` runs, written out here because
//! a match joins it rather than lists it.

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
    /// A bare scope's lookup: only a handle or a topic's name matches,
    /// and only by prefix — what `@sol` proposes is `@solarium`, never
    /// anyone's content.
    pub lookup: bool,
}

/// What a scoped content search is scoped to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Scope {
    /// One person's work: their posts, their comments, and the topics
    /// they tagged their own content with.
    Author {
        id: Uuid,
        /// Their actor address atom — the author of their topic claims.
        /// None for a keyless account, which has claimed nothing.
        address: Option<String>,
    },
    /// What carries one topic: posts and comments whose own author's
    /// current claim names it.
    Topic {
        /// The canonical name, bare.
        name: String,
    },
}

/// One scoped content search over the index. The text fields are the
/// remainder after the scope operator, built by the API's matcher.
#[derive(Debug, Clone)]
pub struct ScopedQuery {
    pub scope: Scope,
    /// The remainder as typed, trimmed: compared case-insensitively for
    /// the exact-match tier.
    pub text: String,
    /// The remainder as a `LIKE` pattern body, matched as a substring of
    /// a topic's name.
    pub like_body: String,
    /// The remainder's words in `to_tsquery` syntax, matched against a
    /// post's title or a comment's thread root's title. None when the
    /// remainder carries no word.
    pub title_query: Option<String>,
    /// The kinds served (`post`, `comment`, `hashtag`). Never empty.
    pub kinds: Vec<String>,
    /// Drop nodes on this account's seen-list (`user_view_log`).
    pub exclude_seen_by: Option<Uuid>,
    /// The viewer's address atom: their own in-flight topic claims count,
    /// as they do on the tag page. None reads landed claims only.
    pub pending_actor: Option<String>,
}

impl ScopedQuery {
    /// `(author id, author address, Type identifier)` — the scope as the
    /// statements bind it.
    fn binds(&self) -> (Option<Uuid>, Option<&str>, Option<String>) {
        match &self.scope {
            Scope::Author { id, address } => (Some(*id), address.as_deref(), None),
            Scope::Topic { name } => (None, None, Some(format!("name:{name}"))),
        }
    }
}

/// A match request of either branch, as a connection keeps it to count
/// under exactly the predicate it paged over.
#[derive(Debug, Clone)]
pub enum SearchRequest {
    Match(MatchQuery),
    Scoped(ScopedQuery),
}

/// A restriction of one page read to part of the request's matches. It
/// narrows what a page may hold, never what the request matches, so
/// [`count`] never sees it: ranked search reads its in-slice candidates
/// `within` the viewer's slice, and pages the rest `excluding` what the
/// ranker ordered (ranked-feed-api §4.8).
#[derive(Debug, Clone, Copy, Default)]
pub struct Window<'a> {
    /// Only these nodes may be served; None restricts nothing.
    pub within: Option<&'a [Uuid]>,
    /// These nodes are never served.
    pub excluding: &'a [Uuid],
}

impl SearchRequest {
    /// One page of matches — see [`find`].
    pub async fn find(
        &self,
        pool: &PgPool,
        cursor: Option<SearchCursor>,
        backward: bool,
        limit: i64,
    ) -> Result<Vec<SearchHit>, sqlx::Error> {
        self.find_in(pool, Window::default(), cursor, backward, limit)
            .await
    }

    /// One page of the matches inside `window` — see [`find_in`].
    pub async fn find_in(
        &self,
        pool: &PgPool,
        window: Window<'_>,
        cursor: Option<SearchCursor>,
        backward: bool,
        limit: i64,
    ) -> Result<Vec<SearchHit>, sqlx::Error> {
        match self {
            Self::Match(q) => find_in(pool, q, window, cursor, backward, limit).await,
            Self::Scoped(q) => find_scoped(pool, q, window, cursor, backward, limit).await,
        }
    }

    /// The total match count — see [`count`].
    pub async fn count(&self, pool: &PgPool) -> Result<i64, sqlx::Error> {
        match self {
            Self::Match(q) => count(pool, q).await,
            Self::Scoped(q) => count_scoped(pool, q).await,
        }
    }
}

/// The person an `@handle` scope names, as the index knows them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScopedAuthor {
    pub id: Uuid,
    pub address: Option<String>,
}

/// The person whose current handle is `folded_handle`, resolved through
/// the index's own handle rows: a handle the index does not carry — a
/// redacted account's included — scopes to no one.
pub async fn scoped_author(
    pool: &PgPool,
    folded_handle: &str,
) -> Result<Option<ScopedAuthor>, sqlx::Error> {
    sqlx::query_as!(
        ScopedAuthor,
        r#"SELECT a.id, a.realization_address AS address
           FROM search_index s
           JOIN actors a ON a.id = s.node_id
           WHERE s.kind = 'user' AND s.field = 'handle' AND s.folded = $1"#,
        folded_handle,
    )
    .fetch_optional(pool)
    .await
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
    find_in(pool, q, Window::default(), cursor, backward, limit).await
}

/// [`find`], served only inside `window`. The window joins the match's
/// own predicate, so a page is still `limit` rows of the request's order.
pub async fn find_in(
    pool: &PgPool,
    q: &MatchQuery,
    window: Window<'_>,
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
                     AND (NOT $11 OR (s.field IN ('handle', 'name')
                                      AND s.folded LIKE lower($2) || '%'))
                     AND ($12::uuid[] IS NULL OR s.node_id = ANY($12))
                     AND NOT (s.node_id = ANY($13::uuid[]))
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
            q.lookup,
            window.within,
            window.excluding,
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
                     AND (NOT $11 OR (s.field IN ('handle', 'name')
                                      AND s.folded LIKE lower($2) || '%'))
                     AND ($12::uuid[] IS NULL OR s.node_id = ANY($12))
                     AND NOT (s.node_id = ANY($13::uuid[]))
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
            q.lookup,
            window.within,
            window.excluding,
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
                 WHERE a.id = s.node_id AND a.realization_address IS NOT NULL))
             AND (NOT $6 OR (s.field IN ('handle', 'name')
                              AND s.folded LIKE lower($1) || '%'))"#,
        q.like_body,
        q.title_query,
        &q.kinds,
        q.exclude_seen_by,
        q.keyed_users_only,
        q.lookup,
    )
    .fetch_one(pool)
    .await
}

/// One page of a scoped content search, in display order — the same
/// order, cursor and page contract as [`find`].
///
/// What may match, by kind:
///
/// - **post** — its title matches the text; under an author scope it is
///   theirs (the index's `(author_id, created_at)` key), under a topic
///   scope it carries the topic.
/// - **comment** — the title of its thread's root post matches the text
///   (a reply is found through the post its thread answers; a comment on
///   an untitled post has no title to be found through). Under an author
///   scope it is theirs; under a topic scope it carries the topic. A
///   comment whose current version is redacted is never found.
/// - **hashtag** — author scope only: its name matches the text, and the
///   person tagged their own content with it.
///
/// A person is never a scoped result: `@handle <text>` returns no row
/// for the person it names. `window` narrows a page as in [`find_in`].
pub async fn find_scoped(
    pool: &PgPool,
    q: &ScopedQuery,
    window: Window<'_>,
    cursor: Option<SearchCursor>,
    backward: bool,
    limit: i64,
) -> Result<Vec<SearchHit>, sqlx::Error> {
    let (tier, at, id) = match cursor {
        Some(c) => (Some(c.tier), Some(c.created_at), Some(c.node_id)),
        None => (None, None, None),
    };
    let (author_id, author_address, topic) = q.binds();
    if backward {
        let mut rows = sqlx::query_as!(
            SearchHit,
            r#"WITH RECURSIVE
               claims AS (
                   SELECT l.source AS node, r.author AS author, l.target AS target,
                          l.p_i AS relevance, FALSE AS pending,
                          r.epoch AS epoch, r.act_time AS act_time,
                          r.position AS position, NULL::timestamptz AS authored_at
                   FROM mirror_record_legs l
                   JOIN mirror_records r ON r.record_id = l.record_id
                   WHERE l.leg = 't' AND l.family = 'tag'
                     AND NOT r.payload_marked
                     AND NOT l.census_unknown
                     AND (l.target = $8 OR ($8::text IS NULL AND r.author = $7))
                     AND r.author = CASE
                             WHEN l.source LIKE 'mint:act:%' THEN split_part(l.source, ':', 3)
                             WHEN l.source LIKE 'prof:%'     THEN split_part(l.source, ':', 2)
                             ELSE NULL
                         END
                 UNION ALL
                   SELECT s.middle, s.author, s.target, s.p_d, TRUE, 0, 0, 0, s.pre_signed_at
                   FROM staged_writes s
                   WHERE s.author = $9
                     AND s.family = 'tag'
                     AND s.middle IS NOT NULL
                     AND octet_length(s.payload) = 0
                     AND s.pre_signed_at IS NOT NULL
                     AND s.state NOT IN ('landed', 'expired')
                     AND (s.target = $8 OR ($8::text IS NULL AND s.author = $7))
                     AND s.author = CASE
                             WHEN s.middle LIKE 'mint:act:%' THEN split_part(s.middle, ':', 3)
                             WHEN s.middle LIKE 'prof:%'     THEN split_part(s.middle, ':', 2)
                             ELSE NULL
                         END
               ),
               carried AS (
                   SELECT w.node, w.target
                   FROM (
                       SELECT DISTINCT ON (author, node, target) node, target, relevance
                       FROM claims
                       ORDER BY author, node, target, pending DESC,
                                epoch DESC, act_time DESC, position DESC, authored_at DESC
                   ) w
                   WHERE w.relevance <> 0
               ),
               chain AS (
                   SELECT c.id AS comment_id, c.created_at, c.target_id, c.target_type
                   FROM comments c
                   WHERE 'comment' = ANY($4)
                     AND (c.author_id = $6
                          OR ($6::uuid IS NULL AND c.l1_node_id IN (SELECT node FROM carried)))
                     AND (SELECT v.redaction_reason IS NULL
                          FROM comment_versions v WHERE v.comment_id = c.id
                          ORDER BY pending DESC,
                                   landed_epoch DESC NULLS LAST,
                                   act_time DESC NULLS LAST,
                                   position DESC NULLS LAST,
                                   created_at DESC, version_id DESC
                          LIMIT 1)
                 UNION ALL
                   SELECT ch.comment_id, ch.created_at, p.target_id, p.target_type
                   FROM chain ch
                   JOIN comments p ON p.id = ch.target_id
                   WHERE ch.target_type = 'comment'
               ),
               hits AS (
                   SELECT s.node_id, s.kind, s.created_at,
                          CASE WHEN s.folded = lower($1) THEN 0 ELSE 1 END AS tier,
                          NULL::text AS name
                   FROM search_index s
                   WHERE 'post' = ANY($4)
                     AND s.kind = 'post' AND s.field = 'title'
                     AND s.words @@ to_tsquery('simple', $3)
                     AND (s.author_id = $6
                          OR ($6::uuid IS NULL AND EXISTS (
                              SELECT 1 FROM posts p
                              JOIN carried k ON k.node = p.l1_node_id
                              WHERE p.id = s.node_id)))
                 UNION ALL
                   SELECT ch.comment_id, 'comment', ch.created_at,
                          CASE WHEN t.folded = lower($1) THEN 0 ELSE 1 END,
                          NULL::text
                   FROM chain ch
                   JOIN search_index t ON t.node_id = ch.target_id AND t.field = 'title'
                   WHERE ch.target_type = 'post'
                     AND t.words @@ to_tsquery('simple', $3)
                 UNION ALL
                   SELECT s.node_id, s.kind, s.created_at,
                          CASE WHEN s.folded = lower($1) THEN 0 ELSE 1 END,
                          s.value
                   FROM search_index s
                   WHERE 'hashtag' = ANY($4)
                     AND $6::uuid IS NOT NULL
                     AND s.kind = 'hashtag' AND s.field = 'name'
                     AND s.folded LIKE '%' || lower($2) || '%'
                     AND EXISTS (SELECT 1 FROM carried k WHERE k.target = 'name:' || s.value)
               )
               SELECT node_id AS "node_id!", kind AS "kind!",
                      tier AS "tier!", created_at AS "created_at!", name
               FROM hits h
               WHERE ($5::uuid IS NULL OR NOT EXISTS (
                         SELECT 1 FROM user_view_log l
                         WHERE l.user_id = $5 AND l.content_id = h.node_id))
                 AND ($14::uuid[] IS NULL OR h.node_id = ANY($14))
                 AND NOT (h.node_id = ANY($15::uuid[]))
                 AND ($10::int IS NULL
                      OR tier < $10
                      OR (tier = $10 AND (created_at, node_id) > ($11::timestamptz, $12::uuid)))
               ORDER BY tier DESC, created_at ASC, node_id ASC
               LIMIT $13"#,
            q.text,
            q.like_body,
            q.title_query,
            &q.kinds,
            q.exclude_seen_by,
            author_id,
            author_address,
            topic,
            q.pending_actor,
            tier,
            at,
            id,
            limit,
            window.within,
            window.excluding,
        )
        .fetch_all(pool)
        .await?;
        rows.reverse();
        Ok(rows)
    } else {
        sqlx::query_as!(
            SearchHit,
            r#"WITH RECURSIVE
               claims AS (
                   SELECT l.source AS node, r.author AS author, l.target AS target,
                          l.p_i AS relevance, FALSE AS pending,
                          r.epoch AS epoch, r.act_time AS act_time,
                          r.position AS position, NULL::timestamptz AS authored_at
                   FROM mirror_record_legs l
                   JOIN mirror_records r ON r.record_id = l.record_id
                   WHERE l.leg = 't' AND l.family = 'tag'
                     AND NOT r.payload_marked
                     AND NOT l.census_unknown
                     AND (l.target = $8 OR ($8::text IS NULL AND r.author = $7))
                     AND r.author = CASE
                             WHEN l.source LIKE 'mint:act:%' THEN split_part(l.source, ':', 3)
                             WHEN l.source LIKE 'prof:%'     THEN split_part(l.source, ':', 2)
                             ELSE NULL
                         END
                 UNION ALL
                   SELECT s.middle, s.author, s.target, s.p_d, TRUE, 0, 0, 0, s.pre_signed_at
                   FROM staged_writes s
                   WHERE s.author = $9
                     AND s.family = 'tag'
                     AND s.middle IS NOT NULL
                     AND octet_length(s.payload) = 0
                     AND s.pre_signed_at IS NOT NULL
                     AND s.state NOT IN ('landed', 'expired')
                     AND (s.target = $8 OR ($8::text IS NULL AND s.author = $7))
                     AND s.author = CASE
                             WHEN s.middle LIKE 'mint:act:%' THEN split_part(s.middle, ':', 3)
                             WHEN s.middle LIKE 'prof:%'     THEN split_part(s.middle, ':', 2)
                             ELSE NULL
                         END
               ),
               carried AS (
                   SELECT w.node, w.target
                   FROM (
                       SELECT DISTINCT ON (author, node, target) node, target, relevance
                       FROM claims
                       ORDER BY author, node, target, pending DESC,
                                epoch DESC, act_time DESC, position DESC, authored_at DESC
                   ) w
                   WHERE w.relevance <> 0
               ),
               chain AS (
                   SELECT c.id AS comment_id, c.created_at, c.target_id, c.target_type
                   FROM comments c
                   WHERE 'comment' = ANY($4)
                     AND (c.author_id = $6
                          OR ($6::uuid IS NULL AND c.l1_node_id IN (SELECT node FROM carried)))
                     AND (SELECT v.redaction_reason IS NULL
                          FROM comment_versions v WHERE v.comment_id = c.id
                          ORDER BY pending DESC,
                                   landed_epoch DESC NULLS LAST,
                                   act_time DESC NULLS LAST,
                                   position DESC NULLS LAST,
                                   created_at DESC, version_id DESC
                          LIMIT 1)
                 UNION ALL
                   SELECT ch.comment_id, ch.created_at, p.target_id, p.target_type
                   FROM chain ch
                   JOIN comments p ON p.id = ch.target_id
                   WHERE ch.target_type = 'comment'
               ),
               hits AS (
                   SELECT s.node_id, s.kind, s.created_at,
                          CASE WHEN s.folded = lower($1) THEN 0 ELSE 1 END AS tier,
                          NULL::text AS name
                   FROM search_index s
                   WHERE 'post' = ANY($4)
                     AND s.kind = 'post' AND s.field = 'title'
                     AND s.words @@ to_tsquery('simple', $3)
                     AND (s.author_id = $6
                          OR ($6::uuid IS NULL AND EXISTS (
                              SELECT 1 FROM posts p
                              JOIN carried k ON k.node = p.l1_node_id
                              WHERE p.id = s.node_id)))
                 UNION ALL
                   SELECT ch.comment_id, 'comment', ch.created_at,
                          CASE WHEN t.folded = lower($1) THEN 0 ELSE 1 END,
                          NULL::text
                   FROM chain ch
                   JOIN search_index t ON t.node_id = ch.target_id AND t.field = 'title'
                   WHERE ch.target_type = 'post'
                     AND t.words @@ to_tsquery('simple', $3)
                 UNION ALL
                   SELECT s.node_id, s.kind, s.created_at,
                          CASE WHEN s.folded = lower($1) THEN 0 ELSE 1 END,
                          s.value
                   FROM search_index s
                   WHERE 'hashtag' = ANY($4)
                     AND $6::uuid IS NOT NULL
                     AND s.kind = 'hashtag' AND s.field = 'name'
                     AND s.folded LIKE '%' || lower($2) || '%'
                     AND EXISTS (SELECT 1 FROM carried k WHERE k.target = 'name:' || s.value)
               )
               SELECT node_id AS "node_id!", kind AS "kind!",
                      tier AS "tier!", created_at AS "created_at!", name
               FROM hits h
               WHERE ($5::uuid IS NULL OR NOT EXISTS (
                         SELECT 1 FROM user_view_log l
                         WHERE l.user_id = $5 AND l.content_id = h.node_id))
                 AND ($14::uuid[] IS NULL OR h.node_id = ANY($14))
                 AND NOT (h.node_id = ANY($15::uuid[]))
                 AND ($10::int IS NULL
                      OR tier > $10
                      OR (tier = $10 AND (created_at, node_id) < ($11::timestamptz, $12::uuid)))
               ORDER BY tier ASC, created_at DESC, node_id DESC
               LIMIT $13"#,
            q.text,
            q.like_body,
            q.title_query,
            &q.kinds,
            q.exclude_seen_by,
            author_id,
            author_address,
            topic,
            q.pending_actor,
            tier,
            at,
            id,
            limit,
            window.within,
            window.excluding,
        )
        .fetch_all(pool)
        .await
    }
}

/// How many nodes a scoped request matches in total, across every page —
/// counted under exactly the predicate [`find_scoped`] pages over.
pub async fn count_scoped(pool: &PgPool, q: &ScopedQuery) -> Result<i64, sqlx::Error> {
    let (author_id, author_address, topic) = q.binds();
    sqlx::query_scalar!(
        r#"WITH RECURSIVE
           claims AS (
               SELECT l.source AS node, r.author AS author, l.target AS target,
                      l.p_i AS relevance, FALSE AS pending,
                      r.epoch AS epoch, r.act_time AS act_time,
                      r.position AS position, NULL::timestamptz AS authored_at
               FROM mirror_record_legs l
               JOIN mirror_records r ON r.record_id = l.record_id
               WHERE l.leg = 't' AND l.family = 'tag'
                 AND NOT r.payload_marked
                 AND NOT l.census_unknown
                 AND (l.target = $7 OR ($7::text IS NULL AND r.author = $6))
                 AND r.author = CASE
                         WHEN l.source LIKE 'mint:act:%' THEN split_part(l.source, ':', 3)
                         WHEN l.source LIKE 'prof:%'     THEN split_part(l.source, ':', 2)
                         ELSE NULL
                     END
             UNION ALL
               SELECT s.middle, s.author, s.target, s.p_d, TRUE, 0, 0, 0, s.pre_signed_at
               FROM staged_writes s
               WHERE s.author = $8
                 AND s.family = 'tag'
                 AND s.middle IS NOT NULL
                 AND octet_length(s.payload) = 0
                 AND s.pre_signed_at IS NOT NULL
                 AND s.state NOT IN ('landed', 'expired')
                 AND (s.target = $7 OR ($7::text IS NULL AND s.author = $6))
                 AND s.author = CASE
                         WHEN s.middle LIKE 'mint:act:%' THEN split_part(s.middle, ':', 3)
                         WHEN s.middle LIKE 'prof:%'     THEN split_part(s.middle, ':', 2)
                         ELSE NULL
                     END
           ),
           carried AS (
               SELECT w.node, w.target
               FROM (
                   SELECT DISTINCT ON (author, node, target) node, target, relevance
                   FROM claims
                   ORDER BY author, node, target, pending DESC,
                            epoch DESC, act_time DESC, position DESC, authored_at DESC
               ) w
               WHERE w.relevance <> 0
           ),
           chain AS (
               SELECT c.id AS comment_id, c.target_id, c.target_type
               FROM comments c
               WHERE 'comment' = ANY($3)
                 AND (c.author_id = $5
                      OR ($5::uuid IS NULL AND c.l1_node_id IN (SELECT node FROM carried)))
                 AND (SELECT v.redaction_reason IS NULL
                      FROM comment_versions v WHERE v.comment_id = c.id
                      ORDER BY pending DESC,
                               landed_epoch DESC NULLS LAST,
                               act_time DESC NULLS LAST,
                               position DESC NULLS LAST,
                               created_at DESC, version_id DESC
                      LIMIT 1)
             UNION ALL
               SELECT ch.comment_id, p.target_id, p.target_type
               FROM chain ch
               JOIN comments p ON p.id = ch.target_id
               WHERE ch.target_type = 'comment'
           ),
           hits AS (
               SELECT s.node_id
               FROM search_index s
               WHERE 'post' = ANY($3)
                 AND s.kind = 'post' AND s.field = 'title'
                 AND s.words @@ to_tsquery('simple', $2)
                 AND (s.author_id = $5
                      OR ($5::uuid IS NULL AND EXISTS (
                          SELECT 1 FROM posts p
                          JOIN carried k ON k.node = p.l1_node_id
                          WHERE p.id = s.node_id)))
             UNION ALL
               SELECT ch.comment_id
               FROM chain ch
               JOIN search_index t ON t.node_id = ch.target_id AND t.field = 'title'
               WHERE ch.target_type = 'post'
                 AND t.words @@ to_tsquery('simple', $2)
             UNION ALL
               SELECT s.node_id
               FROM search_index s
               WHERE 'hashtag' = ANY($3)
                 AND $5::uuid IS NOT NULL
                 AND s.kind = 'hashtag' AND s.field = 'name'
                 AND s.folded LIKE '%' || lower($1) || '%'
                 AND EXISTS (SELECT 1 FROM carried k WHERE k.target = 'name:' || s.value)
           )
           SELECT COUNT(*) AS "count!"
           FROM hits h
           WHERE ($4::uuid IS NULL OR NOT EXISTS (
                     SELECT 1 FROM user_view_log l
                     WHERE l.user_id = $4 AND l.content_id = h.node_id))"#,
        q.like_body,
        q.title_query,
        &q.kinds,
        q.exclude_seen_by,
        author_id,
        author_address,
        topic,
        q.pending_actor,
    )
    .fetch_one(pool)
    .await
}
