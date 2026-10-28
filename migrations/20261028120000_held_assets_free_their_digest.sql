-- A held asset frees its digest (data-model.md "Media areas"; erasure.md
-- §1): one LIVE asset per author per digest.
--
-- Removing a post moves the pictures only it showed under hold, and their
-- bytes leave the live store for the operator-only one. The author is
-- still here and may upload the same file again; under the old indexes
-- that upload resolved, by dedup, to the held row, whose bytes no reader
-- can be served — a broken picture. The held row stays for the archive
-- units that reference it; it just no longer answers for the digest, so
-- the upload mints a fresh live asset beside it.
DROP INDEX media_attachments_author_digest_key;
CREATE UNIQUE INDEX media_attachments_author_digest_key
    ON media_attachments (author_id, digest)
    WHERE state <> 'failed' AND held_at IS NULL;

DROP INDEX media_attachments_author_source_digest_key;
CREATE UNIQUE INDEX media_attachments_author_source_digest_key
    ON media_attachments (author_id, source_digest)
    WHERE source_digest IS NOT NULL AND state <> 'failed' AND held_at IS NULL;
