-- The destination an upload is headed for: a post or a comment. A comment
-- carries half a post's video, so the destination decides the cap an
-- upload is sized, planned and validated against — and the ingest worker
-- re-encodes a `processing` row long after the request that named it is
-- gone, so the row has to remember it.
--
-- The upload session remembers it for the same reason: the destination is
-- named when the session opens, and the bytes are only processed when it
-- completes.
--
-- Every row that exists today was sized against the post cap, so 'post' is
-- what each of them was.

ALTER TABLE media_attachments
    ADD COLUMN scale TEXT NOT NULL DEFAULT 'post'
        CHECK (scale IN ('post', 'comment'));

ALTER TABLE media_upload_sessions
    ADD COLUMN scale TEXT NOT NULL DEFAULT 'post'
        CHECK (scale IN ('post', 'comment'));

-- The default existed to name every existing row. From here each insert
-- states its own, so an upload can never be sized for a destination
-- nobody chose.
ALTER TABLE media_attachments ALTER COLUMN scale DROP DEFAULT;
ALTER TABLE media_upload_sessions ALTER COLUMN scale DROP DEFAULT;
