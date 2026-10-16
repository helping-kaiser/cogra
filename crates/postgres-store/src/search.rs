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
//! redacted or removed content findable. Every unredacted post has a row,
//! an untitled one with the empty title, so a read that lists a person's
//! or a topic's posts still reads them through the index alone.
//!
//! # One matcher, every consumer
//!
//! `search`, the reference finder and the Saved list all read through
//! [`SearchRequest`]; none grows a second predicate. What differs between
//! them is passed in: the kinds served, the seen-list exclusion, the
//! finder's narrowing to what `prepareReference` accepts, and the
//! [`Window`] a read is confined to. Saved's is the reader's Saved list
//! ([`Window::saved_by`]): the statement itself joins the list, orders by
//! save time and stops at the page, so a narrowed Saved page costs one
//! statement bounded by the reader's own saves, whatever page it is.
//!
//! # Sections and tiers
//!
//! A result is sectioned: people, then topics, then content
//! ([`SECTION_PEOPLE`], [`SECTION_TOPICS`], [`SECTION_CONTENT`]). Inside a
//! section an exact match leads. Both fold into one `tier`:
//! `2 · section + (0 if exact, else 1)`, so the order — tier, then newest
//! first, then id — is the sectioned order, and one keyset walks it.
//!
//! # The cue branch
//!
//! A cue — `@prefix`, `#prefix` — names everyone whose handle, or every
//! topic whose name, starts with what was typed ([`find_scoped`]). Bare,
//! it lists the matches themselves, then everything they reach: a
//! person's posts, comments and the topics they tagged their own content
//! with; what carries a topic. With text after it, it is a content search
//! inside what the matches reach.
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

/// The people section: users.
pub const SECTION_PEOPLE: i32 = 0;
/// The topics section: hashtags.
pub const SECTION_TOPICS: i32 = 1;
/// The content section: posts and comments.
pub const SECTION_CONTENT: i32 = 2;
/// How many sections a result has; tiers run `0..2 * SECTIONS`.
pub const SECTIONS: i32 = 3;

/// The section a tier belongs to.
pub fn section_of(tier: i32) -> i32 {
    tier / 2
}

/// One plain-text match request over the index. The text fields are built
/// by the API's matcher; nothing here parses a query.
#[derive(Debug, Clone)]
pub struct MatchQuery {
    /// The query text as typed, trimmed: compared case-insensitively for
    /// the exact-match tier.
    pub text: String,
    /// The text as a `LIKE` pattern body — metacharacters escaped with
    /// `\`, no wildcards — matched as a substring of a topic's name.
    pub like_body: String,
    /// The text's words in `to_tsquery` syntax over the `simple`
    /// configuration, the last as a prefix — matched against a post's
    /// title and a person's handle and display name. None when the text
    /// carries no word.
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

/// What a cue names: the prefix as typed, folded, and as a `LIKE` body.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Scope {
    /// `@prefix` — every person whose handle starts with `cue`.
    Authors {
        /// The folded prefix, compared whole for the exact-match tier.
        cue: String,
        /// The prefix as a `LIKE` pattern body.
        like_body: String,
    },
    /// `#prefix` — every topic whose canonical name starts with `cue`.
    Topics {
        /// The canonical prefix, compared whole for the exact-match tier.
        cue: String,
        /// The prefix as a `LIKE` pattern body.
        like_body: String,
    },
}

/// One cue request over the index. With no text it is a bare cue; with
/// text, a content search inside what the cue reaches.
#[derive(Debug, Clone)]
pub struct ScopedQuery {
    pub scope: Scope,
    /// The text after the cue, trimmed: compared case-insensitively for
    /// the exact-match tier. None for a bare cue.
    pub text: Option<String>,
    /// The text as a `LIKE` pattern body, matched as a substring of a
    /// topic's name. Empty for a bare cue.
    pub like_body: String,
    /// The text's words in `to_tsquery` syntax, matched against a post's
    /// title or a comment's thread root's title. None when the text
    /// carries no word, or there is no text.
    pub title_query: Option<String>,
    /// The kinds served (`user`, `post`, `comment`, `hashtag`). Never
    /// empty.
    pub kinds: Vec<String>,
    /// Drop nodes on this account's seen-list (`user_view_log`).
    pub exclude_seen_by: Option<Uuid>,
    /// The viewer's address atom: their own in-flight topic claims count,
    /// as they do on the tag page. None reads landed claims only.
    pub pending_actor: Option<String>,
}

impl ScopedQuery {
    /// `(handle prefix, topic prefix, cue)` — the scope as the statements
    /// bind it: exactly one prefix is set.
    fn binds(&self) -> (Option<&str>, Option<&str>, &str) {
        match &self.scope {
            Scope::Authors { cue, like_body } => (Some(like_body), None, cue),
            Scope::Topics { cue, like_body } => (None, Some(like_body), cue),
        }
    }

    fn bare(&self) -> bool {
        self.text.is_none()
    }
}

/// A match request of either branch, as a connection keeps it to count
/// under exactly the predicate it paged over.
#[derive(Debug, Clone)]
pub enum SearchRequest {
    Match(MatchQuery),
    Scoped(ScopedQuery),
}

/// A restriction of one page read to part of the request's matches.
/// `within`, `excluding` and `section` narrow what a page may hold, never
/// what the request matches, so a count never sees them: ranked search
/// reads its in-slice candidates `within` the viewer's slice and pages the
/// rest `excluding` what the ranker ordered, one `section` at a time
/// (ranked-feed-api §4.8). `saved_by` is Saved's: it confines the request
/// itself, so [`SearchRequest::count`] takes it too.
#[derive(Debug, Clone, Copy, Default)]
pub struct Window<'a> {
    /// Only these nodes may be served; None restricts nothing.
    pub within: Option<&'a [Uuid]>,
    /// These nodes are never served.
    pub excluding: &'a [Uuid],
    /// Only this section's matches may be served; None restricts nothing.
    pub section: Option<i32>,
    /// Only what this account kept on its Saved list may be served, in the
    /// narrowed list's order (api-spec.md `User.bookmarks`): section, then
    /// newest save first, then id. A hit's `tier` is then its section's
    /// own (`2 · section` — a narrowed Saved list has no exact-match tier)
    /// and its `created_at` the save time, so a [`SearchCursor`] walks the
    /// narrowed list. None serves the matcher's own order.
    pub saved_by: Option<Uuid>,
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

    /// The total match count — see [`count`]. `saved_by` counts only what
    /// that account kept on its Saved list, as [`Window::saved_by`] serves.
    pub async fn count(&self, pool: &PgPool, saved_by: Option<Uuid>) -> Result<i64, sqlx::Error> {
        match self {
            Self::Match(q) => count(pool, q, saved_by).await,
            Self::Scoped(q) => count_scoped(pool, q, saved_by).await,
        }
    }
}

/// One matched node. `tier` folds its section and its match quality:
/// `2 · section`, plus 1 unless a matched field equals the text
/// case-insensitively.
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

/// One page of plain-text matches, in display order (tier, then newest
/// first), whichever way the walk ran. `cursor` is exclusive; `backward`
/// walks toward the head of the order. Fetch `limit + 1` to learn whether
/// another page exists.
///
/// What matches, by kind:
///
/// - **user** — the handle or the display name matches the text by
///   word: every word, the last as a prefix. A handle's words are what
///   the `simple` parser splits it into (`pixel_joiner` holds `pixel`
///   and `joiner`); a fragment from inside a word matches nothing.
/// - **hashtag** — the name contains the text.
/// - **post** — the title matches the text by word, or the author's
///   display name does; an untitled post is reached only through its
///   author.
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
                          MIN(CASE s.kind WHEN 'user' THEN 0 WHEN 'hashtag' THEN 2 ELSE 4 END
                              + CASE WHEN s.folded = lower($1) THEN 0 ELSE 1 END) AS tier,
                          MIN(s.value) FILTER (WHERE s.kind = 'hashtag') AS name
                   FROM search_index s
                   WHERE s.kind = ANY($4)
                     AND ((s.field = 'name' AND s.folded LIKE '%' || lower($2) || '%')
                       OR (s.field = 'handle' AND s.words @@ to_tsquery('simple', $3))
                       OR (s.field = 'title' AND s.words @@ to_tsquery('simple', $3))
                       OR (s.field = 'display_name' AND s.words @@ to_tsquery('simple', $3))
                       OR (s.kind = 'post' AND s.author_id IN (
                           SELECT d.node_id FROM search_index d
                           WHERE d.field = 'display_name'
                             AND d.words @@ to_tsquery('simple', $3))))
                     AND ($5::uuid IS NULL OR NOT EXISTS (
                         SELECT 1 FROM user_view_log l
                         WHERE l.user_id = $5 AND l.content_id = s.node_id))
                     AND (NOT $6 OR s.kind <> 'user' OR EXISTS (
                         SELECT 1 FROM actors a
                         WHERE a.id = s.node_id AND a.realization_address IS NOT NULL))
                     AND ($11::uuid[] IS NULL OR s.node_id = ANY($11))
                     AND NOT (s.node_id = ANY($12::uuid[]))
                     AND ($14::uuid IS NULL OR EXISTS (
                         SELECT 1 FROM user_bookmarks b
                         WHERE b.user_id = $14 AND b.content_id = s.node_id))
                   GROUP BY s.node_id, s.kind, s.created_at
               ),
               placed AS (
                   SELECT h.node_id, h.kind, h.name,
                          CASE WHEN $14::uuid IS NULL THEN h.tier
                               ELSE h.tier / 2 * 2 END AS tier,
                          CASE WHEN $14::uuid IS NULL THEN h.created_at
                               ELSE b.bookmarked_at END AS created_at
                   FROM hits h
                   LEFT JOIN user_bookmarks b
                     ON b.user_id = $14 AND b.content_id = h.node_id
                   WHERE ($13::int IS NULL OR h.tier / 2 = $13)
               )
               SELECT node_id AS "node_id!", kind AS "kind!",
                      tier AS "tier!", created_at AS "created_at!", name
               FROM placed
               WHERE ($7::int IS NULL
                      OR tier < $7
                      OR (tier = $7 AND (created_at, node_id) > ($8::timestamptz, $9::uuid)))
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
            window.within,
            window.excluding,
            window.section,
            window.saved_by,
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
                          MIN(CASE s.kind WHEN 'user' THEN 0 WHEN 'hashtag' THEN 2 ELSE 4 END
                              + CASE WHEN s.folded = lower($1) THEN 0 ELSE 1 END) AS tier,
                          MIN(s.value) FILTER (WHERE s.kind = 'hashtag') AS name
                   FROM search_index s
                   WHERE s.kind = ANY($4)
                     AND ((s.field = 'name' AND s.folded LIKE '%' || lower($2) || '%')
                       OR (s.field = 'handle' AND s.words @@ to_tsquery('simple', $3))
                       OR (s.field = 'title' AND s.words @@ to_tsquery('simple', $3))
                       OR (s.field = 'display_name' AND s.words @@ to_tsquery('simple', $3))
                       OR (s.kind = 'post' AND s.author_id IN (
                           SELECT d.node_id FROM search_index d
                           WHERE d.field = 'display_name'
                             AND d.words @@ to_tsquery('simple', $3))))
                     AND ($5::uuid IS NULL OR NOT EXISTS (
                         SELECT 1 FROM user_view_log l
                         WHERE l.user_id = $5 AND l.content_id = s.node_id))
                     AND (NOT $6 OR s.kind <> 'user' OR EXISTS (
                         SELECT 1 FROM actors a
                         WHERE a.id = s.node_id AND a.realization_address IS NOT NULL))
                     AND ($11::uuid[] IS NULL OR s.node_id = ANY($11))
                     AND NOT (s.node_id = ANY($12::uuid[]))
                     AND ($14::uuid IS NULL OR EXISTS (
                         SELECT 1 FROM user_bookmarks b
                         WHERE b.user_id = $14 AND b.content_id = s.node_id))
                   GROUP BY s.node_id, s.kind, s.created_at
               ),
               placed AS (
                   SELECT h.node_id, h.kind, h.name,
                          CASE WHEN $14::uuid IS NULL THEN h.tier
                               ELSE h.tier / 2 * 2 END AS tier,
                          CASE WHEN $14::uuid IS NULL THEN h.created_at
                               ELSE b.bookmarked_at END AS created_at
                   FROM hits h
                   LEFT JOIN user_bookmarks b
                     ON b.user_id = $14 AND b.content_id = h.node_id
                   WHERE ($13::int IS NULL OR h.tier / 2 = $13)
               )
               SELECT node_id AS "node_id!", kind AS "kind!",
                      tier AS "tier!", created_at AS "created_at!", name
               FROM placed
               WHERE ($7::int IS NULL
                      OR tier > $7
                      OR (tier = $7 AND (created_at, node_id) < ($8::timestamptz, $9::uuid)))
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
            window.within,
            window.excluding,
            window.section,
            window.saved_by,
        )
        .fetch_all(pool)
        .await
    }
}

/// How many nodes the request matches in total, across every page —
/// counted under exactly the predicate [`find`] pages over; with
/// `saved_by`, only what that account kept, as [`Window::saved_by`]
/// serves.
pub async fn count(
    pool: &PgPool,
    q: &MatchQuery,
    saved_by: Option<Uuid>,
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT COUNT(DISTINCT s.node_id) AS "count!"
           FROM search_index s
           WHERE s.kind = ANY($3)
             AND ((s.field = 'name' AND s.folded LIKE '%' || lower($1) || '%')
               OR (s.field = 'handle' AND s.words @@ to_tsquery('simple', $2))
               OR (s.field = 'title' AND s.words @@ to_tsquery('simple', $2))
               OR (s.field = 'display_name' AND s.words @@ to_tsquery('simple', $2))
               OR (s.kind = 'post' AND s.author_id IN (
                   SELECT d.node_id FROM search_index d
                   WHERE d.field = 'display_name'
                     AND d.words @@ to_tsquery('simple', $2))))
             AND ($4::uuid IS NULL OR NOT EXISTS (
                 SELECT 1 FROM user_view_log l
                 WHERE l.user_id = $4 AND l.content_id = s.node_id))
             AND (NOT $5 OR s.kind <> 'user' OR EXISTS (
                 SELECT 1 FROM actors a
                 WHERE a.id = s.node_id AND a.realization_address IS NOT NULL))
             AND ($6::uuid IS NULL OR EXISTS (
                 SELECT 1 FROM user_bookmarks b
                 WHERE b.user_id = $6 AND b.content_id = s.node_id))"#,
        q.like_body,
        q.title_query,
        &q.kinds,
        q.exclude_seen_by,
        q.keyed_users_only,
        saved_by,
    )
    .fetch_one(pool)
    .await
}

/// One page of a cue request, in display order — the same order, cursor
/// and page contract as [`find`].
///
/// The cue's matches — the authors (every person whose handle starts
/// with an `@` cue) or the topics (every topic whose name starts with a
/// `#` cue). What may be served, by kind:
///
/// - **user** — a bare `@` cue only: the authors themselves.
/// - **hashtag** — a bare `#` cue: the topics themselves. Under an `@`
///   cue: a topic an author tagged their own content with, and, with
///   text, whose name contains the text.
/// - **post** — an author's, or one carrying a topic; with text, its
///   title matches the text by word.
/// - **comment** — an author's, or one carrying a topic; with text, the
///   title of its thread's root post matches (a reply is found through
///   the post its thread answers; a comment on an untitled post has no
///   title to be found through). A comment whose current version is
///   redacted is never found.
///
/// With text, the cue's matches themselves are never served:
/// `@sol <text>` searches the work, not the people. `window` narrows a
/// page as in [`find_in`].
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
    let (handle_prefix, topic_prefix, cue) = q.binds();
    if backward {
        let mut rows = sqlx::query_as!(
            SearchHit,
            r#"WITH RECURSIVE
               authors AS (
                   SELECT s.node_id AS id, a.realization_address AS address,
                          s.created_at, s.folded
                   FROM search_index s
                   JOIN actors a ON a.id = s.node_id
                   WHERE s.kind = 'user' AND s.field = 'handle'
                     AND s.folded LIKE lower($6::text) || '%'
               ),
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
                     AND (l.target LIKE 'name:' || $7::text || '%'
                          OR ($7::text IS NULL
                              AND r.author IN (SELECT au.address FROM authors au)))
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
                     AND (s.target LIKE 'name:' || $7::text || '%'
                          OR ($7::text IS NULL
                              AND s.author IN (SELECT au.address FROM authors au)))
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
                     AND (c.author_id IN (SELECT au.id FROM authors au)
                          OR ($7::text IS NOT NULL
                              AND c.l1_node_id IN (SELECT node FROM carried)))
                     AND ($18::uuid IS NULL OR EXISTS (
                         SELECT 1 FROM user_bookmarks b
                         WHERE b.user_id = $18 AND b.content_id = c.id))
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
                   SELECT au.id AS node_id, 'user' AS kind, au.created_at,
                          CASE WHEN au.folded = lower($8) THEN 0 ELSE 1 END AS tier,
                          NULL::text AS name
                   FROM authors au
                   WHERE $10 AND 'user' = ANY($4)
                 UNION ALL
                   SELECT s.node_id, s.kind, s.created_at,
                          CASE WHEN s.folded = lower($8) THEN 2 ELSE 3 END,
                          s.value
                   FROM search_index s
                   WHERE $10 AND 'hashtag' = ANY($4)
                     AND s.kind = 'hashtag' AND s.field = 'name'
                     AND s.folded LIKE $7::text || '%'
                 UNION ALL
                   SELECT s.node_id, s.kind, s.created_at,
                          CASE WHEN s.folded = lower($1) THEN 4 ELSE 5 END,
                          NULL::text
                   FROM search_index s
                   WHERE 'post' = ANY($4)
                     AND s.kind = 'post' AND s.field = 'title'
                     AND ($10 OR s.words @@ to_tsquery('simple', $3))
                     AND ($18::uuid IS NULL OR EXISTS (
                         SELECT 1 FROM user_bookmarks b
                         WHERE b.user_id = $18 AND b.content_id = s.node_id))
                     AND (s.author_id IN (SELECT au.id FROM authors au)
                          OR ($7::text IS NOT NULL AND EXISTS (
                              SELECT 1 FROM posts p
                              JOIN carried k ON k.node = p.l1_node_id
                              WHERE p.id = s.node_id)))
                 UNION ALL
                   SELECT ch.comment_id, 'comment', ch.created_at,
                          CASE WHEN t.folded = lower($1) THEN 4 ELSE 5 END,
                          NULL::text
                   FROM chain ch
                   LEFT JOIN search_index t
                     ON t.node_id = ch.target_id AND t.field = 'title'
                    AND ch.target_type = 'post'
                   WHERE ch.target_type <> 'comment'
                     AND ($10 OR t.words @@ to_tsquery('simple', $3))
                 UNION ALL
                   SELECT s.node_id, s.kind, s.created_at,
                          CASE WHEN s.folded = lower($1) THEN 2 ELSE 3 END,
                          s.value
                   FROM search_index s
                   WHERE 'hashtag' = ANY($4)
                     AND $6::text IS NOT NULL
                     AND s.kind = 'hashtag' AND s.field = 'name'
                     AND ($10 OR s.folded LIKE '%' || lower($2) || '%')
                     AND EXISTS (SELECT 1 FROM carried k WHERE k.target = 'name:' || s.value)
               ),
               placed AS (
                   SELECT h.node_id, h.kind, h.name,
                          CASE WHEN $18::uuid IS NULL THEN h.tier
                               ELSE h.tier / 2 * 2 END AS tier,
                          CASE WHEN $18::uuid IS NULL THEN h.created_at
                               ELSE b.bookmarked_at END AS created_at
                   FROM hits h
                   LEFT JOIN user_bookmarks b
                     ON b.user_id = $18 AND b.content_id = h.node_id
                   WHERE ($18::uuid IS NULL OR b.user_id IS NOT NULL)
                     AND ($5::uuid IS NULL OR NOT EXISTS (
                         SELECT 1 FROM user_view_log l
                         WHERE l.user_id = $5 AND l.content_id = h.node_id))
                     AND ($15::uuid[] IS NULL OR h.node_id = ANY($15))
                     AND NOT (h.node_id = ANY($16::uuid[]))
                     AND ($17::int IS NULL OR h.tier / 2 = $17)
               )
               SELECT node_id AS "node_id!", kind AS "kind!",
                      tier AS "tier!", created_at AS "created_at!", name
               FROM placed
               WHERE ($11::int IS NULL
                      OR tier < $11
                      OR (tier = $11 AND (created_at, node_id) > ($12::timestamptz, $13::uuid)))
               ORDER BY tier DESC, created_at ASC, node_id ASC
               LIMIT $14"#,
            q.text,
            q.like_body,
            q.title_query,
            &q.kinds,
            q.exclude_seen_by,
            handle_prefix,
            topic_prefix,
            cue,
            q.pending_actor,
            q.bare(),
            tier,
            at,
            id,
            limit,
            window.within,
            window.excluding,
            window.section,
            window.saved_by,
        )
        .fetch_all(pool)
        .await?;
        rows.reverse();
        Ok(rows)
    } else {
        sqlx::query_as!(
            SearchHit,
            r#"WITH RECURSIVE
               authors AS (
                   SELECT s.node_id AS id, a.realization_address AS address,
                          s.created_at, s.folded
                   FROM search_index s
                   JOIN actors a ON a.id = s.node_id
                   WHERE s.kind = 'user' AND s.field = 'handle'
                     AND s.folded LIKE lower($6::text) || '%'
               ),
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
                     AND (l.target LIKE 'name:' || $7::text || '%'
                          OR ($7::text IS NULL
                              AND r.author IN (SELECT au.address FROM authors au)))
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
                     AND (s.target LIKE 'name:' || $7::text || '%'
                          OR ($7::text IS NULL
                              AND s.author IN (SELECT au.address FROM authors au)))
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
                     AND (c.author_id IN (SELECT au.id FROM authors au)
                          OR ($7::text IS NOT NULL
                              AND c.l1_node_id IN (SELECT node FROM carried)))
                     AND ($18::uuid IS NULL OR EXISTS (
                         SELECT 1 FROM user_bookmarks b
                         WHERE b.user_id = $18 AND b.content_id = c.id))
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
                   SELECT au.id AS node_id, 'user' AS kind, au.created_at,
                          CASE WHEN au.folded = lower($8) THEN 0 ELSE 1 END AS tier,
                          NULL::text AS name
                   FROM authors au
                   WHERE $10 AND 'user' = ANY($4)
                 UNION ALL
                   SELECT s.node_id, s.kind, s.created_at,
                          CASE WHEN s.folded = lower($8) THEN 2 ELSE 3 END,
                          s.value
                   FROM search_index s
                   WHERE $10 AND 'hashtag' = ANY($4)
                     AND s.kind = 'hashtag' AND s.field = 'name'
                     AND s.folded LIKE $7::text || '%'
                 UNION ALL
                   SELECT s.node_id, s.kind, s.created_at,
                          CASE WHEN s.folded = lower($1) THEN 4 ELSE 5 END,
                          NULL::text
                   FROM search_index s
                   WHERE 'post' = ANY($4)
                     AND s.kind = 'post' AND s.field = 'title'
                     AND ($10 OR s.words @@ to_tsquery('simple', $3))
                     AND ($18::uuid IS NULL OR EXISTS (
                         SELECT 1 FROM user_bookmarks b
                         WHERE b.user_id = $18 AND b.content_id = s.node_id))
                     AND (s.author_id IN (SELECT au.id FROM authors au)
                          OR ($7::text IS NOT NULL AND EXISTS (
                              SELECT 1 FROM posts p
                              JOIN carried k ON k.node = p.l1_node_id
                              WHERE p.id = s.node_id)))
                 UNION ALL
                   SELECT ch.comment_id, 'comment', ch.created_at,
                          CASE WHEN t.folded = lower($1) THEN 4 ELSE 5 END,
                          NULL::text
                   FROM chain ch
                   LEFT JOIN search_index t
                     ON t.node_id = ch.target_id AND t.field = 'title'
                    AND ch.target_type = 'post'
                   WHERE ch.target_type <> 'comment'
                     AND ($10 OR t.words @@ to_tsquery('simple', $3))
                 UNION ALL
                   SELECT s.node_id, s.kind, s.created_at,
                          CASE WHEN s.folded = lower($1) THEN 2 ELSE 3 END,
                          s.value
                   FROM search_index s
                   WHERE 'hashtag' = ANY($4)
                     AND $6::text IS NOT NULL
                     AND s.kind = 'hashtag' AND s.field = 'name'
                     AND ($10 OR s.folded LIKE '%' || lower($2) || '%')
                     AND EXISTS (SELECT 1 FROM carried k WHERE k.target = 'name:' || s.value)
               ),
               placed AS (
                   SELECT h.node_id, h.kind, h.name,
                          CASE WHEN $18::uuid IS NULL THEN h.tier
                               ELSE h.tier / 2 * 2 END AS tier,
                          CASE WHEN $18::uuid IS NULL THEN h.created_at
                               ELSE b.bookmarked_at END AS created_at
                   FROM hits h
                   LEFT JOIN user_bookmarks b
                     ON b.user_id = $18 AND b.content_id = h.node_id
                   WHERE ($18::uuid IS NULL OR b.user_id IS NOT NULL)
                     AND ($5::uuid IS NULL OR NOT EXISTS (
                         SELECT 1 FROM user_view_log l
                         WHERE l.user_id = $5 AND l.content_id = h.node_id))
                     AND ($15::uuid[] IS NULL OR h.node_id = ANY($15))
                     AND NOT (h.node_id = ANY($16::uuid[]))
                     AND ($17::int IS NULL OR h.tier / 2 = $17)
               )
               SELECT node_id AS "node_id!", kind AS "kind!",
                      tier AS "tier!", created_at AS "created_at!", name
               FROM placed
               WHERE ($11::int IS NULL
                      OR tier > $11
                      OR (tier = $11 AND (created_at, node_id) < ($12::timestamptz, $13::uuid)))
               ORDER BY tier ASC, created_at DESC, node_id DESC
               LIMIT $14"#,
            q.text,
            q.like_body,
            q.title_query,
            &q.kinds,
            q.exclude_seen_by,
            handle_prefix,
            topic_prefix,
            cue,
            q.pending_actor,
            q.bare(),
            tier,
            at,
            id,
            limit,
            window.within,
            window.excluding,
            window.section,
            window.saved_by,
        )
        .fetch_all(pool)
        .await
    }
}

/// How many nodes a cue request matches in total, across every page —
/// counted under exactly the predicate [`find_scoped`] pages over; with
/// `saved_by`, only what that account kept, as [`Window::saved_by`]
/// serves.
pub async fn count_scoped(
    pool: &PgPool,
    q: &ScopedQuery,
    saved_by: Option<Uuid>,
) -> Result<i64, sqlx::Error> {
    let (handle_prefix, topic_prefix, _) = q.binds();
    sqlx::query_scalar!(
        r#"WITH RECURSIVE
           authors AS (
               SELECT s.node_id AS id, a.realization_address AS address
               FROM search_index s
               JOIN actors a ON a.id = s.node_id
               WHERE s.kind = 'user' AND s.field = 'handle'
                 AND s.folded LIKE lower($5::text) || '%'
           ),
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
                 AND (l.target LIKE 'name:' || $6::text || '%'
                      OR ($6::text IS NULL
                          AND r.author IN (SELECT au.address FROM authors au)))
                 AND r.author = CASE
                         WHEN l.source LIKE 'mint:act:%' THEN split_part(l.source, ':', 3)
                         WHEN l.source LIKE 'prof:%'     THEN split_part(l.source, ':', 2)
                         ELSE NULL
                     END
             UNION ALL
               SELECT s.middle, s.author, s.target, s.p_d, TRUE, 0, 0, 0, s.pre_signed_at
               FROM staged_writes s
               WHERE s.author = $7
                 AND s.family = 'tag'
                 AND s.middle IS NOT NULL
                 AND octet_length(s.payload) = 0
                 AND s.pre_signed_at IS NOT NULL
                 AND s.state NOT IN ('landed', 'expired')
                 AND (s.target LIKE 'name:' || $6::text || '%'
                      OR ($6::text IS NULL
                          AND s.author IN (SELECT au.address FROM authors au)))
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
                 AND (c.author_id IN (SELECT au.id FROM authors au)
                      OR ($6::text IS NOT NULL
                          AND c.l1_node_id IN (SELECT node FROM carried)))
                 AND ($9::uuid IS NULL OR EXISTS (
                     SELECT 1 FROM user_bookmarks b
                     WHERE b.user_id = $9 AND b.content_id = c.id))
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
               SELECT au.id AS node_id
               FROM authors au
               WHERE $8 AND 'user' = ANY($3)
             UNION ALL
               SELECT s.node_id
               FROM search_index s
               WHERE $8 AND 'hashtag' = ANY($3)
                 AND s.kind = 'hashtag' AND s.field = 'name'
                 AND s.folded LIKE $6::text || '%'
             UNION ALL
               SELECT s.node_id
               FROM search_index s
               WHERE 'post' = ANY($3)
                 AND s.kind = 'post' AND s.field = 'title'
                 AND ($8 OR s.words @@ to_tsquery('simple', $2))
                 AND ($9::uuid IS NULL OR EXISTS (
                     SELECT 1 FROM user_bookmarks b
                     WHERE b.user_id = $9 AND b.content_id = s.node_id))
                 AND (s.author_id IN (SELECT au.id FROM authors au)
                      OR ($6::text IS NOT NULL AND EXISTS (
                          SELECT 1 FROM posts p
                          JOIN carried k ON k.node = p.l1_node_id
                          WHERE p.id = s.node_id)))
             UNION ALL
               SELECT ch.comment_id
               FROM chain ch
               LEFT JOIN search_index t
                 ON t.node_id = ch.target_id AND t.field = 'title'
                AND ch.target_type = 'post'
               WHERE ch.target_type <> 'comment'
                 AND ($8 OR t.words @@ to_tsquery('simple', $2))
             UNION ALL
               SELECT s.node_id
               FROM search_index s
               WHERE 'hashtag' = ANY($3)
                 AND $5::text IS NOT NULL
                 AND s.kind = 'hashtag' AND s.field = 'name'
                 AND ($8 OR s.folded LIKE '%' || lower($1) || '%')
                 AND EXISTS (SELECT 1 FROM carried k WHERE k.target = 'name:' || s.value)
           )
           SELECT COUNT(*) AS "count!"
           FROM hits h
           WHERE ($4::uuid IS NULL OR NOT EXISTS (
                     SELECT 1 FROM user_view_log l
                     WHERE l.user_id = $4 AND l.content_id = h.node_id))
             AND ($9::uuid IS NULL OR EXISTS (
                     SELECT 1 FROM user_bookmarks b
                     WHERE b.user_id = $9 AND b.content_id = h.node_id))"#,
        q.like_body,
        q.title_query,
        &q.kinds,
        q.exclude_seen_by,
        handle_prefix,
        topic_prefix,
        q.pending_actor,
        q.bare(),
        saved_by,
    )
    .fetch_one(pool)
    .await
}
