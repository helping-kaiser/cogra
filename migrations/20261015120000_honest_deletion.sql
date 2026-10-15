-- Honest deletion (data-model.md "Act payload carriage", "The retention
-- archive"; retention-archive.md §1): the retention archive as the one
-- store a redacted act's content outlives its carriage in, and the
-- columns that let every copy of a payload be reduced.
--
-- A redaction is one transaction per act: the archive unit is written,
-- the carriage row is reduced and every staged copy is reaped together,
-- so no committed state holds an archive row without the reduction or a
-- reduction without its archive row.

-- Carriage becomes reducible. A reduced row holds no bytes and no salt —
-- NULL, never the zero-length string, because zero bytes is the canonical
-- empty payload and would be indistinguishable from "never had bytes".
-- The salt goes with the payload: it is the value that keeps the witness
-- concealing, and the original removes the two atomically. The row
-- itself is never deleted, and the moment it was reduced is kept.
ALTER TABLE act_payloads
    ALTER COLUMN payload      DROP NOT NULL,
    ALTER COLUMN content_salt DROP NOT NULL,
    ADD COLUMN reduced_at TIMESTAMPTZ,
    ADD CONSTRAINT act_payloads_salt_goes_with_payload
        CHECK ((payload IS NULL) = (content_salt IS NULL)),
    ADD CONSTRAINT act_payloads_bytes_absent_iff_reduced
        CHECK ((payload IS NULL) = (payload_state = 'reduced')),
    ADD CONSTRAINT act_payloads_reduced_at_iff_reduced
        CHECK ((reduced_at IS NULL) = (payload_state = 'full'));

COMMENT ON COLUMN act_payloads.payload IS
    'The envelope bytes; NULL exactly when the payload is reduced (never zero-length: that is the canonical empty payload).';

-- A staged row keeps its structural columns after its act is redacted —
-- expiry, the reap and a late landing all read them — but none of the
-- three values that would reopen the content: the payload, its content
-- salt, and the proposal nonce (the public pre-commitment is formed over
-- nonce and payload, so a kept nonce confirms a guessed payload). The
-- moment of the reap is the mark that the NULL is a redaction, not a
-- write that never had bytes. An act carried with an application is
-- never reaped: it is deleted outright with the account.
ALTER TABLE staged_writes
    ALTER COLUMN payload DROP NOT NULL,
    ADD COLUMN payload_reaped_at TIMESTAMPTZ,
    ADD CONSTRAINT staged_writes_payload_absent_iff_reaped
        CHECK ((payload IS NULL) = (payload_reaped_at IS NOT NULL)),
    ADD CONSTRAINT staged_writes_reaped_conceals
        CHECK (payload IS NOT NULL OR (nonce IS NULL AND content_salt IS NULL)),
    ADD CONSTRAINT staged_writes_carried_never_reaped
        CHECK (payload IS NOT NULL OR state <> 'carried');

-- The retention archive: one row per redacted entity, schema-on-read in
-- `original_data`. A graph-side redaction writes one row per act holding
-- the whole unit — envelope, content salt, proposal nonce, the witness,
-- and the list of media the envelope names — so the row re-verifies
-- against the public record on its own. `legal_hold_until` NULL means
-- held until a manual operator act: the MVP runs no hard-delete job.
-- Unique on the redaction's identity, which is what makes a retried
-- redaction write its unit once.
CREATE TABLE retention_archive (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    original_id      TEXT        NOT NULL,
    original_type    TEXT        NOT NULL,
    original_data    JSONB       NOT NULL,
    redaction_reason TEXT        NOT NULL,
    redacted_by      TEXT        NOT NULL,
    redacted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    legal_hold_until TIMESTAMPTZ,
    UNIQUE (original_id, original_type, redacted_by)
);

-- The media a unit references, as rows rather than only inside the JSON:
-- an asset is never copied into an archive row, it is referenced, and the
-- reference is what keeps a shared asset alive. The foreign key makes
-- that structural — no media row any held unit names can be deleted —
-- and the media-side index serves "does any other unit still name it?",
-- the question every hard delete asks. The references go with their
-- unit when the unit is hard-deleted.
CREATE TABLE retention_archive_media (
    archive_id UUID NOT NULL REFERENCES retention_archive(id) ON DELETE CASCADE,
    media_id   UUID NOT NULL REFERENCES media_attachments(id),
    PRIMARY KEY (archive_id, media_id)
);
CREATE INDEX retention_archive_media_media_idx ON retention_archive_media (media_id);

-- When an asset's last live placement was redacted: from then on the
-- asset belongs to the archive, under the units that reference it. NULL
-- while any placement still shows it — one asset can sit in several
-- placements, and the redaction of one leaves it serving the others.
ALTER TABLE media_attachments ADD COLUMN held_at TIMESTAMPTZ;
