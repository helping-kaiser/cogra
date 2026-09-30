-- A re-encoded upload whose rendition is an asset its author already
-- holds resolves to that asset instead of failing.
--
-- `(author_id, digest)` names at most one live asset: a manifest is
-- turned back into rows by digest, so two rows for one author's bytes
-- would make a gallery ambiguous. The upload path honours that by handing
-- a re-upload the row that already exists. A re-encode cannot do the
-- same thing at the same moment — its row was minted, and its id handed
-- to the client, before the rendition's digest existed — so the row
-- settles `merged` instead: it names the asset it turned out to be, every
-- read by its id answers with that asset, and it serves nothing itself.
--
-- A merged row keeps the digest it arrived with, which is exactly what
-- lets a retry of the same file find it (and through it the asset) under
-- the existing unique indexes. It never answers a manifest: those resolve
-- `ready` rows only.

ALTER TABLE media_attachments
    DROP CONSTRAINT media_attachments_state_check,
    ADD CONSTRAINT media_attachments_state_check
        CHECK (state IN ('processing', 'ready', 'failed', 'merged')),
    ADD COLUMN merged_into UUID REFERENCES media_attachments(id),
    ADD CONSTRAINT media_attachments_merged_into_iff_merged
        CHECK ((state = 'merged') = (merged_into IS NOT NULL)),
    ADD CONSTRAINT media_attachments_merged_into_not_self
        CHECK (merged_into <> id);

-- A merged row is a reference to its asset, so the orphan sweep probes it
-- before collecting that asset, and every media_attachments delete checks
-- it as a foreign key. Postgres creates no index behind a foreign key, so
-- without this both are sequential scans. Partial: almost no row is merged.
CREATE INDEX media_attachments_merged_into_idx
    ON media_attachments (merged_into)
    WHERE merged_into IS NOT NULL;
