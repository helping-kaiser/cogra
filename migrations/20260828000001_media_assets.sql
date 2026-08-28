-- Media assets: bind the row to the digest the payload envelope commits
-- and to the object in the media store that holds the bytes.
--
-- The columns are added NOT NULL without a backfill because nothing has
-- ever written this table: no upload path, no junction write, no resolver
-- (the only media-aware code is the pending sweep's junction deletes). A
-- row that did exist could carry no honest digest, so failing loudly here
-- is the correct outcome rather than inventing one.

ALTER TABLE media_attachments
    -- The bytes are addressed by a server-generated object key, and the
    -- public URL is minted per read from the media origin's configured
    -- base. A stored absolute URL would bake a deployment's address into
    -- the row and rot the moment the origin moves — which in development
    -- is every network change.
    DROP COLUMN url,
    -- SHA-256 over the stored bytes, computed after metadata stripping so
    -- the digest describes exactly what the store holds and what a reader
    -- can recompute. The algorithm rides beside it so a future change is
    -- a migration rather than a reinterpretation of existing rows.
    ADD COLUMN digest           BYTEA       NOT NULL,
    ADD COLUMN digest_algo      TEXT        NOT NULL DEFAULT 'sha256',
    -- Opaque and server-generated, deliberately not the digest: identical
    -- bytes from two authors get two objects, so removing one author's
    -- asset can never break the other's. Unique because two rows sharing
    -- one object would make that guarantee false again.
    ADD COLUMN storage_key      TEXT        NOT NULL UNIQUE,
    -- The tombstone shape every version table already uses: redaction
    -- removes the bytes and leaves the mark (layers.md §5).
    ADD COLUMN redaction_reason TEXT,
    ADD COLUMN redacted_at      TIMESTAMPTZ;

-- One asset per author per digest: a retried upload of the same picture
-- resolves to the row that already exists instead of a second object.
ALTER TABLE media_attachments
    ADD CONSTRAINT media_attachments_author_digest_key UNIQUE (author_id, digest);

-- The author-only index is redundant behind that constraint's index,
-- which leads with the same column and serves every author-keyed lookup
-- as a prefix scan.
DROP INDEX media_attachments_author_idx;
