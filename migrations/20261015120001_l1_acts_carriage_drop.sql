-- The stand-in's half of honest deletion. Owned by the l1-standin crate
-- and dropped at the swap with the rest of the l1_* set: the real Layer 1
-- never holds carriage, so it never owes this.
--
-- Acceptance already nulls an act's payload, content salt and nonce. An
-- act that never reached acceptance — sealed, or approved and deferred
-- for a missing dependency or an insolvent author — still holds them, and
-- a redaction of its author's content has to drop them there too. The
-- moment of that drop is kept, so a NULL on an unaccepted row is a
-- recorded redaction rather than a row that lost its custody silently.
ALTER TABLE l1_acts ADD COLUMN carriage_dropped_at TIMESTAMPTZ;

ALTER TABLE l1_acts
    DROP CONSTRAINT l1_acts_handshake_custody,
    ADD CONSTRAINT l1_acts_handshake_custody CHECK (
        (payload IS NULL) = (content_salt IS NULL)
        AND (payload IS NULL) = (nonce IS NULL)
        AND (payload IS NOT NULL OR status = 'accepted' OR carriage_dropped_at IS NOT NULL)
    );

COMMENT ON COLUMN l1_acts.carriage_dropped_at IS
    'When a redaction dropped the transient custody of an act that had not reached acceptance.';
