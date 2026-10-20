-- The search index under the unified search law (api-spec.md "Search";
-- data-model.md "Search index"). Two changes to the projection serve it.
--
-- 1. `words` covers display names as well as titles. Plain text matches an
--    author's display name by word prefix ("Mod" finds "Genesis
--    Moderator", "enesis" finds nothing), the same full-text shape titles
--    match by. A generated column's expression cannot be altered in place
--    before PostgreSQL 17 (ALTER COLUMN ... SET EXPRESSION), and the dev
--    stacks run 16 and 18, so the column is dropped and added again — its
--    index goes with it — and one partial index per field serves each
--    field's match.
--
-- 2. Every post whose current version is unredacted has a row; an untitled
--    post's row carries the empty title. A person or topic cue lists every
--    post of its matches, titled or not, and plain text reaches every post
--    of an author whose display name matches — so the index, not each
--    read, keeps deciding what is findable: redaction still takes the row
--    away, through the one derivation the trigger runs. An empty title
--    holds no word and equals no query, so no text ever matches it.

ALTER TABLE search_index DROP COLUMN words;
ALTER TABLE search_index ADD COLUMN words TSVECTOR GENERATED ALWAYS AS (
    CASE WHEN field IN ('title', 'display_name')
         THEN to_tsvector('simple'::regconfig, value)
    END
) STORED;

CREATE INDEX search_index_titles_fts
    ON search_index USING gin (words)
    WHERE field = 'title';
CREATE INDEX search_index_display_names_fts
    ON search_index USING gin (words)
    WHERE field = 'display_name';

-- The per-node derivation, as migration `search_index_trigger` states it,
-- with the post branch keeping an untitled post: its row's value is the
-- empty string. Everything else — the lock, the user and topic branches,
-- the current-version orders — is unchanged.
CREATE OR REPLACE FUNCTION search_index_rederive(node_kind TEXT, node UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('search_index'), hashtext(node::text));
    DELETE FROM search_index WHERE kind = node_kind AND node_id = node;
    IF node_kind = 'user' THEN
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
        WHERE a.id = node
          AND a.kind = 'user'
          AND p.redaction_reason IS NULL
          AND f.value IS NOT NULL
          AND btrim(f.value) <> '';
    ELSIF node_kind = 'post' THEN
        INSERT INTO search_index (node_id, field, kind, value, author_id, created_at)
        SELECT p.id, 'title', 'post',
               CASE WHEN btrim(COALESCE(v.title, '')) = '' THEN '' ELSE v.title END,
               p.author_id, p.created_at
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
        WHERE p.id = node
          AND v.redaction_reason IS NULL;
    ELSIF node_kind = 'hashtag' THEN
        INSERT INTO search_index (node_id, field, kind, value, created_at)
        SELECT id, 'name', 'hashtag', name, created_at
        FROM hashtags
        WHERE id = node;
    ELSE
        RAISE EXCEPTION 'search_index_rederive: unknown kind %', node_kind;
    END IF;
END;
$$;

-- The untitled posts join the index.
SELECT search_index_rebuild('post');
