-- Pending profile versions (substrate.md §6; architecture.md "The write
-- path"): a profile update is its author's content from the
-- pre-commitment signature onward, like every other display write, so
-- its version row exists from that moment and every reader is served it,
-- marked pending, until the record lands. Migration `pending_content`
-- gave post and comment versions the same mark.
--
-- The mark is an explicit flag, as on the other version tables: a NULL
-- landing coordinate already means "no record stands behind this row" on
-- the registration seed, so the coordinates cannot also say "the record
-- has not landed yet". Every row written before this migration was
-- written at confirm, so FALSE is the true backfill.
--
-- A pending row is L2-operational, like the staged row it belongs to:
-- when the update expires unlanded the row is deleted with it, and the
-- previous version renders again (data-model.md "Staged writes").
ALTER TABLE actor_profile_versions
    ADD COLUMN pending BOOLEAN NOT NULL DEFAULT FALSE;

-- A pending row is keyed by its write's pre-commitment instant — the
-- pre-sign leg's retry idempotence is an ON CONFLICT on the pair, and
-- confirm and expiry find the row by it. Partial, because rows written
-- before this migration took `now()` and may share an instant (migration
-- `profile_version_monotonic_key`); only pending rows need the key.
CREATE UNIQUE INDEX actor_profile_versions_pending_instant_key
    ON actor_profile_versions (actor_id, created_at)
    WHERE pending;

-- `pending` leads the current-version key: a pending version sorts above
-- every landed one (api-spec.md "Reads serve pending content").
DROP INDEX actor_profile_versions_current_idx;
CREATE INDEX actor_profile_versions_current_idx
    ON actor_profile_versions (actor_id, pending DESC,
                               landed_epoch DESC NULLS LAST,
                               act_time     DESC NULLS LAST,
                               position     DESC NULLS LAST,
                               created_at DESC, version_id DESC);

-- The per-node search derivation, as migration `search_index_unified_law`
-- states it, with the user branch reading the current profile version in
-- the reads' own order — pending first — so a pending display name is
-- findable exactly as it is shown. Everything else is unchanged.
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
            ORDER BY pending DESC,
                     landed_epoch DESC NULLS LAST,
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
