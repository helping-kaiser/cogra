-- The key of record orders (layer1-interface.md §8.3): the pair
-- (epoch, position), compared lexicographically. Act time is derived from
-- that order and decides no precedence, so it leaves every index on the
-- order and both SQL functions that compare a row's place in it. The
-- act_time columns stay: the published record carries its act time
-- (§8.4), and the display rows keep the copy they stamp.

-- The listing indexes: the global post listing and a node's thread.
DROP INDEX posts_landing_order_idx;
CREATE INDEX posts_landing_order_idx ON posts (landed_epoch DESC, position DESC);

DROP INDEX comments_target_order_idx;
CREATE INDEX comments_target_order_idx ON comments (target_id, landed_epoch, position);

-- The current-version indexes, one per version table, in the reads' own
-- order: a pending version first where the table carries the mark, then
-- the newest landing by its key of record.
DROP INDEX post_versions_current_idx;
CREATE INDEX post_versions_current_idx
    ON post_versions (post_id, pending DESC,
                      landed_epoch DESC NULLS LAST,
                      position     DESC NULLS LAST,
                      created_at DESC, version_id DESC);

DROP INDEX comment_versions_current_idx;
CREATE INDEX comment_versions_current_idx
    ON comment_versions (comment_id, pending DESC,
                         landed_epoch DESC NULLS LAST,
                         position     DESC NULLS LAST,
                         created_at DESC, version_id DESC);

DROP INDEX actor_profile_versions_current_idx;
CREATE INDEX actor_profile_versions_current_idx
    ON actor_profile_versions (actor_id, pending DESC,
                               landed_epoch DESC NULLS LAST,
                               position     DESC NULLS LAST,
                               created_at DESC, version_id DESC);

DROP INDEX chat_versions_current_idx;
CREATE INDEX chat_versions_current_idx
    ON chat_versions (chat_id,
                      landed_epoch DESC NULLS LAST,
                      position     DESC NULLS LAST,
                      created_at DESC, version_id DESC);

DROP INDEX chat_message_versions_current_idx;
CREATE INDEX chat_message_versions_current_idx
    ON chat_message_versions (chat_message_id,
                              landed_epoch DESC NULLS LAST,
                              position     DESC NULLS LAST,
                              created_at DESC, version_id DESC);

DROP INDEX item_versions_current_idx;
CREATE INDEX item_versions_current_idx
    ON item_versions (item_id,
                      landed_epoch DESC NULLS LAST,
                      position     DESC NULLS LAST,
                      created_at DESC, version_id DESC);

DROP INDEX network_parameter_versions_current_idx;
CREATE INDEX network_parameter_versions_current_idx
    ON network_parameter_versions (parameter,
                                   landed_epoch DESC NULLS LAST,
                                   position     DESC NULLS LAST,
                                   created_at DESC, version_id DESC);

-- The per-node search derivation, as migration
-- `profile_pending_versions` states it, with the current version chosen
-- by the key of record. Everything else is unchanged.
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

-- Whether any live placement still shows an asset, as migration
-- `honest_deletion` states it, with the act that wrote a version found by
-- the version's key of record (epoch, position) — the mirror's unique
-- key. Everything else is unchanged.
CREATE OR REPLACE FUNCTION media_live_placed(asset UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
               SELECT 1
               FROM post_attachments a
               JOIN post_versions v ON v.version_id = a.post_version_id
               WHERE (a.attachment_id = asset OR a.cover_media_id = asset)
                 AND v.redaction_reason IS NULL
                 AND NOT EXISTS (
                       SELECT 1 FROM mirror_records r
                       JOIN act_payloads c ON c.act_id = r.record_id
                       WHERE r.epoch = v.landed_epoch AND r.position = v.position
                         AND c.payload_state = 'reduced'))
        OR EXISTS (
               SELECT 1
               FROM comment_attachments a
               JOIN comment_versions v ON v.version_id = a.comment_version_id
               WHERE (a.attachment_id = asset OR a.cover_media_id = asset)
                 AND v.redaction_reason IS NULL
                 AND NOT EXISTS (
                       SELECT 1 FROM mirror_records r
                       JOIN act_payloads c ON c.act_id = r.record_id
                       WHERE r.epoch = v.landed_epoch AND r.position = v.position
                         AND c.payload_state = 'reduced'))
        OR EXISTS (
               SELECT 1
               FROM actor_profile_versions p
               WHERE p.avatar_id = asset
                 AND p.redaction_reason IS NULL
                 AND NOT EXISTS (
                       SELECT 1 FROM mirror_records r
                       JOIN act_payloads c ON c.act_id = r.record_id
                       WHERE r.epoch = p.landed_epoch AND r.position = p.position
                         AND c.payload_state = 'reduced'))
        OR EXISTS (SELECT 1 FROM chat_message_attachments a WHERE a.attachment_id = asset)
        OR EXISTS (SELECT 1 FROM item_attachments         a WHERE a.attachment_id = asset)
        OR EXISTS (SELECT 1 FROM chat_versions            c WHERE c.image_id = asset)
$$;
