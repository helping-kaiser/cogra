-- The mark on a leg whose census metadata was fabricated at ingest.
--
-- A leg's domain, mask and tier are family-fixed by the census, never
-- carried in the package. A leg whose role the census does not describe
-- cannot occur in a census-valid package — but a published record is
-- never dropped, so ingestion writes minimal fallback metadata and keeps
-- going. Without a mark those invented values are indistinguishable from
-- census truth at read time, in the one store that "may lag L1 and must
-- never diverge".
--
-- The mark makes the divergence a fact a reader can see: parameter folds
-- exclude a marked leg rather than sum unvalidated numbers into a stance,
-- and the record read carries it so the chronicle can say so.
--
-- FALSE is the true backfill: every leg written before this migration
-- was written from a census spec or logged as fabricated at the time.

ALTER TABLE mirror_record_legs
    ADD COLUMN census_unknown BOOLEAN NOT NULL DEFAULT FALSE;

-- Marked legs are the exception, so the index that finds them is partial
-- — an operator asking "what did ingestion invent?" should not pay for a
-- scan of every leg ever landed.
CREATE INDEX mirror_record_legs_census_unknown_idx
    ON mirror_record_legs (record_id)
    WHERE census_unknown;
