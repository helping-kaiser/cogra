-- The stand-in's acts after the handshake took the original's structure
-- (`def:graph:proposal-pre-commitment`, `def:graph:verified-act`) and the
-- host became witness-only at acceptance (data-model.md "Act payload
-- carriage"). Owned by the l1-standin crate and dropped at the swap with
-- the rest of the l1_* set.
--
-- `pre_commitment` is structural: both commitments bind it and the
-- ordering fraud proof re-derives the dependency commitment over it, so
-- it is kept for every act. `payload_len` is the length the published
-- record marks its payload by; it is stored because the payload itself
-- does not outlive acceptance.
--
-- Rows sealed before this migration carry an empty pre-commitment. None
-- of them verifies under the current formulas; the next genesis retires
-- them with the world they belong to.
ALTER TABLE l1_acts
    ADD COLUMN pre_commitment BYTEA,
    ADD COLUMN payload_len    BIGINT;

UPDATE l1_acts SET pre_commitment = ''::BYTEA, payload_len = length(payload);

ALTER TABLE l1_acts
    ALTER COLUMN pre_commitment SET NOT NULL,
    ALTER COLUMN payload_len    SET NOT NULL,
    ALTER COLUMN payload        DROP NOT NULL,
    ALTER COLUMN content_salt   DROP NOT NULL,
    ALTER COLUMN nonce          DROP NOT NULL,
    ADD CONSTRAINT l1_acts_payload_len_nonnegative CHECK (payload_len >= 0),
    -- Handshake custody: the payload, its content salt and the proposal
    -- nonce are held together from seal, and nulled together only at
    -- acceptance. The dependency salt is never nulled.
    ADD CONSTRAINT l1_acts_handshake_custody CHECK (
        (payload IS NULL) = (content_salt IS NULL)
        AND (payload IS NULL) = (nonce IS NULL)
        AND (payload IS NOT NULL OR status = 'accepted')
    );

COMMENT ON COLUMN l1_acts.payload IS
    'Transient handshake custody: held from seal until acceptance, then NULL. act_payloads is the carriage.';
COMMENT ON COLUMN l1_acts.content_salt IS
    'Transient handshake custody, nulled with the payload at acceptance.';
COMMENT ON COLUMN l1_acts.nonce IS
    'Transient handshake custody, nulled with the payload at acceptance: the public pre-commitment is formed over it.';
