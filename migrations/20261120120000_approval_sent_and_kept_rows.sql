-- Approval sends and kept rows (data-model.md "Staged writes").
--
-- The GC keeps a staged write the host may still order: one whose
-- approval the host accepted, or one whose approval was sent with no
-- refusal back. The send is recorded before the host is called, so a
-- crash or an unknown outcome between the host taking the approval and
-- the server recording it leaves the mark standing. A definite refusal
-- takes it back.
--
-- The count of approval sends whose outcome is not known: raised in a
-- committed write before every relay of an approval, lowered when the
-- host answers (accepted or refused). A crash, a transport error or a
-- timeout leaves it raised. A count rather than a flag, so a refusal of
-- one send never takes back the mark of another send of the same
-- approval that is still in flight.
ALTER TABLE staged_writes
    ADD COLUMN approval_sends_open INTEGER NOT NULL DEFAULT 0,
    ADD CONSTRAINT staged_writes_approval_sends_not_negative
        CHECK (approval_sends_open >= 0);

COMMENT ON COLUMN staged_writes.approval_sends_open IS
    'Approval relays sent whose outcome is not known; raised before the host is called, lowered by its answer.';

-- The moment the GC kept the row as the act's structure, instead of
-- deleting it: a write whose approval was accepted or sent, with its
-- content pair moved into carriage (payload_custodied_at) or already
-- removed by a redaction (payload_reaped_at). A kept row holds no payload
-- and no host seal; it keeps the content commitment, and the dependency
-- opening — the dependency nonce, the dependency salt and the dependency
-- commitment — whole. A row custodied before this migration had its
-- opening dropped, so a kept row holds the three together or none.
ALTER TABLE staged_writes
    ADD COLUMN kept_at TIMESTAMPTZ;

COMMENT ON COLUMN staged_writes.kept_at IS
    'When the GC kept the row as the act''s structure for a late landing; set with payload_custodied_at, or on a row a redaction reaped.';

UPDATE staged_writes
SET kept_at = payload_custodied_at
WHERE payload_custodied_at IS NOT NULL;

-- A custodied row is a kept row; what a kept row holds replaces the
-- custody-only state rule.
ALTER TABLE staged_writes
    DROP CONSTRAINT staged_writes_custodied_only_after_expiry,
    ADD CONSTRAINT staged_writes_custodied_is_kept
        CHECK (payload_custodied_at IS NULL OR kept_at IS NOT NULL),
    ADD CONSTRAINT staged_writes_kept_structure
        CHECK (kept_at IS NULL
               OR (state IN ('expired', 'landed')
                   AND payload IS NULL
                   AND host_seal IS NULL
                   AND content_commitment IS NOT NULL
                   AND (dependency_nonce IS NULL) = (deps_salt IS NULL)
                   AND (deps_salt IS NULL) = (deps_commitment IS NULL)));
