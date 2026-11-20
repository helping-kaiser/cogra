-- The record mirror stores what a published record holds at the replay
-- floor (data-model.md "The record mirror"): beside the content commitment
-- it already keeps, the approved body in its canonical encoding, the
-- author key, the signed pre-commitment, the dependency commitment, the
-- formation edition each commitment names, the host seal and the
-- approval witness.
--
-- Additive and valid on a non-empty mirror. The columns are NULL on every
-- record mirrored before the package carried them; the next ingestion
-- pass fills them from the published packages, read back through the seam
-- (architecture.md "Record ingestion"). A record holds the floor whole or
-- not at all, and the partial index finds the ones still to fill.
ALTER TABLE mirror_records
    ADD COLUMN body                  BYTEA,
    ADD COLUMN author_pubkey         BYTEA,
    ADD COLUMN pre_commitment        BYTEA,
    ADD COLUMN pre_signature         BYTEA,
    ADD COLUMN dependency_commitment BYTEA,
    ADD COLUMN content_edition       BIGINT,
    ADD COLUMN dependency_edition    BIGINT,
    ADD COLUMN host_seal             BYTEA,
    ADD COLUMN approval_signature    BYTEA,
    ADD CONSTRAINT mirror_records_floor_whole CHECK (
        num_nulls(body, author_pubkey, pre_commitment, pre_signature,
                  dependency_commitment, content_edition, dependency_edition,
                  host_seal, approval_signature) IN (0, 9)
    );

CREATE INDEX mirror_records_floor_unfilled_idx ON mirror_records (epoch) WHERE body IS NULL;

COMMENT ON COLUMN mirror_records.body IS
    'The approved structural body, in the canonical encoding the pre-commitment, the seal and the approval cover.';
COMMENT ON COLUMN mirror_records.approval_signature IS
    'The author''s approval witness over the verified act and its host seal.';
