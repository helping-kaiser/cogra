-- The search index follows its sources by trigger (data-model.md "Search
-- index"). The projection's one write path is the database itself: a
-- row-level trigger on every table an indexed value is derived from
-- re-derives the affected node's rows in the writing transaction, so no
-- writer — a store function, a migration, an operator's hand-run SQL —
-- can change a source and leave the index behind. A forgotten writer
-- would leave redacted or removed content findable; this closes that
-- class for the index.
--
-- This is the repo's only sanctioned trigger pattern, reserved for
-- erasure-propagation guarantees.
--
-- Sources, per kind (the derivation's reads):
--   user    — actors (id, kind, handle, created_at) and
--             actor_profile_versions (the current version's display_name
--             and redaction_reason; the landing-order columns pick it)
--   post    — posts (id, author_id, created_at) and post_versions (the
--             current version's title and redaction_reason; pending and
--             the landing-order columns pick it)
--   hashtag — hashtags (id, name, created_at)
-- Every column of those tables is covered: a trigger fires on any INSERT,
-- UPDATE or DELETE, never on a column list a later column could escape.

-- Re-derives one node's rows: deletes them, then inserts what the current
-- value warrants. A node that no longer exists, a user whose current
-- profile version is redacted, a post whose current version is redacted
-- or untitled, all end with no row. The current-version orders are the
-- reads' own (postgres-store `content::post`, `profile::current_profile`).
--
-- The transaction-scoped advisory lock serializes the re-derivations of
-- one node across concurrent writers. Without it, under READ COMMITTED, a
-- writer whose DELETE waited on a concurrent re-derivation would skip the
-- rows that one then committed — and a redaction racing a rename would
-- leave the renamed rows findable. Held to commit, the lock makes the last
-- re-derivation of a node see every committed write to its sources.
--
-- VOLATILE (the default) is load-bearing: only a volatile function sees
-- the triggering statement's own changes.
CREATE FUNCTION search_index_rederive(node_kind TEXT, node UUID)
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
        WHERE p.id = node
          AND v.redaction_reason IS NULL
          AND v.title IS NOT NULL
          AND btrim(v.title) <> '';
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

-- Re-derives every node of a kind: drops the kind's rows (a node whose
-- source rows are gone has nothing left to re-derive from), then runs the
-- per-node derivation over every source node — one derivation per kind,
-- never a second copy of it.
CREATE FUNCTION search_index_rebuild(node_kind TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM search_index WHERE kind = node_kind;
    IF node_kind = 'user' THEN
        PERFORM search_index_rederive('user', id) FROM actors WHERE kind = 'user';
    ELSIF node_kind = 'post' THEN
        PERFORM search_index_rederive('post', id) FROM posts;
    ELSIF node_kind = 'hashtag' THEN
        PERFORM search_index_rederive('hashtag', id) FROM hashtags;
    ELSE
        RAISE EXCEPTION 'search_index_rebuild: unknown kind %', node_kind;
    END IF;
END;
$$;

-- The row-level trigger function. TG_ARGV[0] names the kind the table
-- feeds, TG_ARGV[1] the column holding the node's id. An UPDATE that
-- moves a row to another node re-derives both: the one it left and the
-- one it joined. Row-level AFTER triggers fire at the end of the
-- statement, when the statement's changes are complete and visible.
CREATE FUNCTION search_index_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    old_node UUID;
    new_node UUID;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        old_node := (to_jsonb(OLD) ->> TG_ARGV[1])::uuid;
        PERFORM search_index_rederive(TG_ARGV[0], old_node);
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        new_node := (to_jsonb(NEW) ->> TG_ARGV[1])::uuid;
        IF new_node IS DISTINCT FROM old_node THEN
            PERFORM search_index_rederive(TG_ARGV[0], new_node);
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

-- TRUNCATE fires no row-level DELETE trigger (PostgreSQL docs, TRUNCATE
-- notes), so each source also carries a statement-level AFTER TRUNCATE
-- trigger that rebuilds the kind it feeds.
CREATE FUNCTION search_index_follow_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM search_index_rebuild(TG_ARGV[0]);
    RETURN NULL;
END;
$$;

CREATE TRIGGER search_index_follow
    AFTER INSERT OR UPDATE OR DELETE ON actors
    FOR EACH ROW EXECUTE FUNCTION search_index_follow('user', 'id');
CREATE TRIGGER search_index_follow
    AFTER INSERT OR UPDATE OR DELETE ON actor_profile_versions
    FOR EACH ROW EXECUTE FUNCTION search_index_follow('user', 'actor_id');
CREATE TRIGGER search_index_follow
    AFTER INSERT OR UPDATE OR DELETE ON posts
    FOR EACH ROW EXECUTE FUNCTION search_index_follow('post', 'id');
CREATE TRIGGER search_index_follow
    AFTER INSERT OR UPDATE OR DELETE ON post_versions
    FOR EACH ROW EXECUTE FUNCTION search_index_follow('post', 'post_id');
CREATE TRIGGER search_index_follow
    AFTER INSERT OR UPDATE OR DELETE ON hashtags
    FOR EACH ROW EXECUTE FUNCTION search_index_follow('hashtag', 'id');

CREATE TRIGGER search_index_follow_truncate
    AFTER TRUNCATE ON actors
    FOR EACH STATEMENT EXECUTE FUNCTION search_index_follow_truncate('user');
CREATE TRIGGER search_index_follow_truncate
    AFTER TRUNCATE ON actor_profile_versions
    FOR EACH STATEMENT EXECUTE FUNCTION search_index_follow_truncate('user');
CREATE TRIGGER search_index_follow_truncate
    AFTER TRUNCATE ON posts
    FOR EACH STATEMENT EXECUTE FUNCTION search_index_follow_truncate('post');
CREATE TRIGGER search_index_follow_truncate
    AFTER TRUNCATE ON post_versions
    FOR EACH STATEMENT EXECUTE FUNCTION search_index_follow_truncate('post');
CREATE TRIGGER search_index_follow_truncate
    AFTER TRUNCATE ON hashtags
    FOR EACH STATEMENT EXECUTE FUNCTION search_index_follow_truncate('hashtag');

-- Start the trigger from the derivation itself: whatever the index holds
-- now is replaced by what the sources warrant.
SELECT search_index_rebuild('user');
SELECT search_index_rebuild('post');
SELECT search_index_rebuild('hashtag');
