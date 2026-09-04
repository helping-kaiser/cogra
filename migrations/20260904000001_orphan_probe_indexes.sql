-- The four reference probes the orphan sweep runs without an index.
--
-- `media::sweep_orphans` asks eight questions before it deletes an asset —
-- one per way anything can reference one. Four of them are served
-- (post_attachments, comment_attachments, media_attachments.cover_media_id,
-- media_upload_sessions.media_id); these four are not, so each was a
-- sequential scan over its whole table, once per candidate row.
--
-- The same columns are the paths PostgreSQL walks for its own foreign-key
-- re-check on every media_attachments DELETE, and no index is created
-- behind a foreign key — so the unindexed probe and the unindexed integrity
-- check compound on the one statement that holds the table's row locks.
--
-- The chat and item junctions were deferred to their own slices on the
-- reasoning that a junction earns its reverse index when its write path
-- arrives. The sweep is the counter-case: it queries all eight regardless
-- of which slices are built, so the cost is paid today by a table that is
-- empty today.

CREATE INDEX chat_message_attachments_attachment_idx
    ON chat_message_attachments (attachment_id);
CREATE INDEX item_attachments_attachment_idx
    ON item_attachments (attachment_id);

-- Partial on both: the column is null on every actor and chat that carries
-- no picture, and the sweep's probe and the FK re-check only ever look for
-- a value. Same shape as media_attachments_cover_media_idx.
CREATE INDEX actor_profile_versions_avatar_idx
    ON actor_profile_versions (avatar_id)
    WHERE avatar_id IS NOT NULL;
CREATE INDEX chat_versions_image_idx
    ON chat_versions (image_id)
    WHERE image_id IS NOT NULL;
