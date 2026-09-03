-- Resumable uploads: the server-side bookkeeping that lets one large
-- upload survive a dropped connection.
--
-- The bytes themselves never land here. They ride the media store's own
-- multipart upload, which holds the parts between requests; these two
-- tables hold only what the server must remember to finish that upload
-- later — which store-side upload the session belongs to, how the client
-- was told to cut the file up, and which parts have actually arrived.
--
-- Keeping our own part list is not redundancy with the store. S3's
-- guidance is explicit that a completion must quote the part identifiers
-- the uploader recorded rather than a listing read back from the store,
-- because the listing omits parts still in flight and would silently
-- assemble a truncated object.

CREATE TABLE media_upload_sessions (
    id              UUID        PRIMARY KEY,
    -- Whose upload this is. Every part write and the completion both
    -- re-check the viewer against this column, so a leaked session id is
    -- not a way into someone else's upload.
    author_id       UUID        NOT NULL REFERENCES actors(id),
    -- Where the parts assemble. A staging key, never the asset's final
    -- one: the pipeline strips metadata before it digests, so the bytes
    -- that arrive and the bytes that are stored are different bytes, and
    -- the final key is not knowable until the strip has run.
    storage_key     TEXT        NOT NULL UNIQUE,
    -- The store's own identifier for the multipart upload. This is what
    -- makes the upload outlive the request that opened it.
    upload_id       TEXT        NOT NULL,
    -- What the client said it was sending. A courtesy bound only: it
    -- lets an impossible upload be refused before a byte is spent, and
    -- it fixes the part arithmetic below. It is never evidence about the
    -- bytes — the sniff at completion decides what the file is and which
    -- cap it answers to.
    declared_bytes  BIGINT      NOT NULL,
    -- The cut the server dictated, and the part count that follows from
    -- it. The server dictates rather than the client proposing because
    -- S3 requires every part but the last to be at least 5 MiB, and a
    -- client that guessed smaller would upload a whole file only to have
    -- the assembly refused.
    part_size_bytes INTEGER     NOT NULL,
    part_count      INTEGER     NOT NULL,
    -- The asset a finished session produced. Null while the upload is
    -- still open; set at the moment the row is written, which is what
    -- makes completion idempotent — a client whose connection dropped
    -- during completion retries and is handed the same asset instead of
    -- a refusal or a second object.
    media_id        UUID        REFERENCES media_attachments(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- When the sweeper may collect this session and abort its parts.
    -- Until an upload is completed or aborted the store bills for the
    -- parts and no reader can see them, so an abandoned session is pure
    -- cost and is collected rather than left to linger.
    expires_at      TIMESTAMPTZ NOT NULL
);

-- The sweep's access path: it asks only for sessions past their expiry.
CREATE INDEX media_upload_sessions_expiry_idx
    ON media_upload_sessions (expires_at);

-- The orphan sweep probes this column to find out whether an asset is
-- still spoken for by the session that produced it. Without an index
-- leading with it that probe is a sequential scan of every session, run
-- once per candidate asset — the same reason every content junction
-- carries a reverse index on its attachment.
CREATE INDEX media_upload_sessions_media_idx
    ON media_upload_sessions (media_id)
    WHERE media_id IS NOT NULL;

CREATE TABLE media_upload_parts (
    session_id  UUID        NOT NULL
                            REFERENCES media_upload_sessions(id) ON DELETE CASCADE,
    -- One-based, the numbering S3 documents for its own part numbers, so
    -- a client reading either specification sees the same numbers.
    part_number INTEGER     NOT NULL,
    -- The identifier the store returned for this part, quoted back at
    -- completion.
    content_id  TEXT        NOT NULL,
    -- What actually arrived, as opposed to what was declared. The
    -- completion sums these and refuses a session whose real size clears
    -- a cap, so a client that under-declared its file cannot buy itself
    -- a larger allowance by lying at the start.
    size_bytes  INTEGER     NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- The primary key is the idempotency. A re-sent part collides here
    -- and overwrites its own row, exactly as the same part number
    -- overwrites its own bytes in the store, so a client that retries a
    -- part it is unsure of converges instead of corrupting the upload.
    PRIMARY KEY (session_id, part_number)
);
