-- The record mirror stores what a published record holds at the replay
-- floor (data-model.md "The record mirror"), in its two members: beside the
-- content commitment it already keeps, the act's approval — the approved
-- body in its canonical encoding, the dependency commitment, the author key
-- and the approval witness — and the seal attestation published beside the
-- act — the signed pre-commitment, the formation edition each commitment
-- names, the frame version and the host seal. Each mirrored epoch keeps
-- the approval form its package states.
--
-- Additive and valid on a non-empty mirror. The record columns are NULL on
-- every record mirrored before the package carried them; the next
-- ingestion pass fills them from the published packages, read back through
-- the seam (architecture.md "Record ingestion"). A record holds the floor
-- whole or not at all, and the partial index finds the ones still to fill.
-- Every epoch mirrored before this migration was published in approval
-- form 1, so the epoch column fills with 1 and then loses its default.
ALTER TABLE mirror_records
    ADD COLUMN body                  BYTEA,
    ADD COLUMN author_pubkey         BYTEA,
    ADD COLUMN pre_commitment        BYTEA,
    ADD COLUMN pre_signature         BYTEA,
    ADD COLUMN dependency_commitment BYTEA,
    ADD COLUMN content_edition       BIGINT,
    ADD COLUMN dependency_edition    BIGINT,
    ADD COLUMN seal_version          BIGINT,
    ADD COLUMN host_seal             BYTEA,
    ADD COLUMN approval_signature    BYTEA,
    ADD CONSTRAINT mirror_records_floor_whole CHECK (
        num_nulls(body, author_pubkey, pre_commitment, pre_signature,
                  dependency_commitment, content_edition, dependency_edition,
                  seal_version, host_seal, approval_signature) IN (0, 10)
    );

CREATE INDEX mirror_records_floor_unfilled_idx ON mirror_records (epoch) WHERE body IS NULL;

COMMENT ON COLUMN mirror_records.body IS
    'The approved structural body, in the canonical encoding the approval, the pre-commitment and the seal cover.';
COMMENT ON COLUMN mirror_records.approval_signature IS
    'The author''s approval witness, in the approval form of the record''s epoch (mirror_epochs.approval_form).';

ALTER TABLE mirror_epochs
    ADD COLUMN approval_form SMALLINT NOT NULL DEFAULT 1
        CONSTRAINT mirror_epochs_approval_form_known CHECK (approval_form IN (1, 2));
ALTER TABLE mirror_epochs ALTER COLUMN approval_form DROP DEFAULT;
