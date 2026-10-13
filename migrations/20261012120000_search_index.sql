-- The search index (data-model.md "Search index"; api-spec.md "Search"):
-- the one matcher's projection. An overlay cache — rebuildable from the
-- version tables at any time — holding one row per indexed field of a
-- node's CURRENT value. The version tables are append-only with many rows
-- per node, so an index over them would match superseded titles; this
-- table carries only the value a read serves now.
--
-- Rows: a user actor's `handle` and `display_name`, a post's `title`, a
-- registered topic's `name`. An untitled post has no row. A redacted
-- value (the current version carries a non-null redaction_reason) has no
-- row either: redaction appends a tombstone whose fields still hold a
-- marker, and without the explicit skip a substring query for "redacted"
-- would surface every redacted handle and title.
--
-- Maintenance: the store functions that write the sources refresh their
-- node's rows in the same transaction (postgres-store `search`).

-- Trigram operator classes for substring matching on the name-class
-- fields; a trusted contrib extension, shipped with the official images.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE search_index (
    node_id    UUID        NOT NULL,
    field      TEXT        NOT NULL,
    kind       TEXT        NOT NULL,
    value      TEXT        NOT NULL,
    -- Case folding for the name-class match and the exact-match tier.
    folded     TEXT        GENERATED ALWAYS AS (lower(value)) STORED,
    -- Word-level full text over titles: the `simple` configuration, so no
    -- stemming and no stop words — a title in any language matches as typed.
    words      TSVECTOR    GENERATED ALWAYS AS (
                   CASE WHEN field = 'title'
                        THEN to_tsvector('simple'::regconfig, value)
                   END
               ) STORED,
    -- A post's author: the join an @-scope runs through.
    author_id  UUID,
    -- The recency key: the node's createdAt; a topic's registry entry age.
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (node_id, field),
    CHECK (
        (kind = 'user'    AND field IN ('handle', 'display_name') AND author_id IS NULL) OR
        (kind = 'post'    AND field = 'title'                     AND author_id IS NOT NULL) OR
        (kind = 'hashtag' AND field = 'name'                      AND author_id IS NULL)
    )
);

CREATE INDEX search_index_names_trgm
    ON search_index USING gin (folded gin_trgm_ops)
    WHERE field <> 'title';
CREATE INDEX search_index_titles_fts
    ON search_index USING gin (words)
    WHERE field = 'title';
CREATE INDEX search_index_author_recency
    ON search_index (author_id, created_at DESC)
    WHERE author_id IS NOT NULL;

-- Backfill from the current, unredacted versions. The current-version
-- orders are the reads' own (postgres-store `content::post`,
-- `profile::current_profile`).
INSERT INTO search_index (node_id, field, kind, value, created_at)
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
WHERE a.kind = 'user'
  AND p.redaction_reason IS NULL
  AND f.value IS NOT NULL
  AND btrim(f.value) <> '';

INSERT INTO search_index (node_id, field, kind, value, author_id, created_at)
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
WHERE v.redaction_reason IS NULL
  AND v.title IS NOT NULL
  AND btrim(v.title) <> '';

INSERT INTO search_index (node_id, field, kind, value, created_at)
SELECT id, 'name', 'hashtag', name, created_at
FROM hashtags;
