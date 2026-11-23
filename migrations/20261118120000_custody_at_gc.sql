-- Custody at GC (data-model.md "Staged writes", "Act payload carriage").
--
-- A staged write that never lands is expired and, a GC window later,
-- reaped. The host may still hold its act approved and order it later.
-- So the reap of a sealed, approved write with a non-empty payload moves
-- the content pair (payload, content nonce, content salt) into carriage
-- first, and the staged row stays as the act's structure. A late landing
-- reads the record marked and whole and builds its display rows from that
-- structure. A redaction or an account deletion reduces the carriage row
-- like any other.

-- The moment the host took the approval: written when the relay of the
-- approval witness succeeded. The handshake state cannot carry it,
-- because expiry overwrites the state.
ALTER TABLE staged_writes ADD COLUMN approved_at TIMESTAMPTZ;

COMMENT ON COLUMN staged_writes.approved_at IS
    'When the host accepted the approval witness; set by the relay, kept through expiry.';

-- A row the GC moved into carriage holds no payload and no content
-- nonce or salt, as a reaped row does. The moment of the move tells the
-- two NULLs apart: a redaction reap holds no bytes anywhere, and a custody
-- move holds them in act_payloads.
ALTER TABLE staged_writes
    ADD COLUMN payload_custodied_at TIMESTAMPTZ,
    DROP CONSTRAINT staged_writes_payload_absent_iff_reaped,
    ADD CONSTRAINT staged_writes_payload_absent_iff_reaped_or_custodied
        CHECK ((payload IS NULL) = (payload_reaped_at IS NOT NULL OR payload_custodied_at IS NOT NULL)),
    ADD CONSTRAINT staged_writes_reaped_or_custodied_not_both
        CHECK (payload_reaped_at IS NULL OR payload_custodied_at IS NULL),
    ADD CONSTRAINT staged_writes_custodied_only_after_expiry
        CHECK (payload_custodied_at IS NULL OR state IN ('expired', 'landed'));

COMMENT ON COLUMN staged_writes.payload_custodied_at IS
    'When the GC moved the content pair into act_payloads; the row keeps the act''s structure for a late landing.';

-- A non-empty world: an approval this server already relayed is a write
-- in `relaying` that holds no withheld witness. A row that already
-- expired keeps no trace of its approval and stays unmarked.
UPDATE staged_writes
SET approved_at = updated_at
WHERE state = 'relaying' AND held_approval_signature IS NULL;
