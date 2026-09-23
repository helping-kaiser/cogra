-- Media ingest state: an asset is `processing` until its final bytes
-- exist, `ready` from then on, or `failed` with a reason its author can
-- read.
--
-- The payload envelope commits an asset's digest at prepare, and nothing
-- may change the bytes after that. So everything the server does to a
-- video — probe, re-encode, re-validate — happens between the upload and
-- the prepare, and prepare refuses an asset that is not `ready`. The
-- digest a row carries once it is `ready` is the digest of the only
-- bytes that asset ever serves.
--
-- Every row that exists today is `ready`, and stays exactly as it is:
-- its digest may already be witnessed by a landed record, so no row is
-- re-encoded after the fact.

ALTER TABLE media_attachments
    ADD COLUMN state          TEXT        NOT NULL DEFAULT 'ready'
        CHECK (state IN ('processing', 'ready', 'failed')),
    -- What an author reads when an upload could not be made servable.
    -- Present exactly when the asset failed, so a client never has to
    -- guess which of the two columns to believe.
    ADD COLUMN failure_reason TEXT,
    -- The digest of the bytes as they arrived (after the metadata strip),
    -- kept on a re-encoded asset so a retried upload of the same file
    -- resolves to the asset it already produced rather than to a second
    -- transcode. Null on an asset stored as it arrived, whose `digest` is
    -- already that.
    ADD COLUMN source_digest  BYTEA,
    -- The ingest queue's claim. A worker leases a `processing` row and
    -- renews the lease while it works; a worker that dies stops renewing,
    -- and the row is claimable again once the lease runs out.
    ADD COLUMN lease_until    TIMESTAMPTZ,
    ADD COLUMN attempts       INTEGER     NOT NULL DEFAULT 0,
    ADD CONSTRAINT media_attachments_failure_reason_iff_failed
        CHECK ((state = 'failed') = (failure_reason IS NOT NULL));

-- The default existed to mark every existing row `ready`. From here each
-- insert states its own, so an upload can never skip processing by
-- forgetting to say which state it is in.
ALTER TABLE media_attachments ALTER COLUMN state DROP DEFAULT;

-- One live asset per author per digest, as before — but a failed asset
-- no longer holds its digest: an author whose upload failed can upload
-- the same file again once the cause is gone.
ALTER TABLE media_attachments DROP CONSTRAINT media_attachments_author_digest_key;
CREATE UNIQUE INDEX media_attachments_author_digest_key
    ON media_attachments (author_id, digest)
    WHERE state <> 'failed';

-- The same rule for the bytes as they arrived, so two retries of one
-- over-target upload cannot become two transcodes.
CREATE UNIQUE INDEX media_attachments_author_source_digest_key
    ON media_attachments (author_id, source_digest)
    WHERE source_digest IS NOT NULL AND state <> 'failed';

-- The queue's own index: the claim reads the oldest `processing` row, and
-- at rest there are none, so the partial index is empty almost always.
CREATE INDEX media_attachments_processing_idx
    ON media_attachments (created_at)
    WHERE state = 'processing';
