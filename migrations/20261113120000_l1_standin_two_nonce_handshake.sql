-- The stand-in's acts under the two-nonce admission handshake
-- (layer1-interface.md §8.2, "The admission handshake"). Owned by the
-- l1-standin crate and dropped at the swap with the rest of the l1_* set.
--
-- The host receives the structural body, the dependency list with its
-- dependency nonce, the opaque content pre-digest, the pre-commitment and
-- the pre-signature — never the payload or the content nonce, and it
-- applies no nonce policy of its own. So the act's row loses everything it
-- kept about the payload and the one shared nonce, and gains the
-- dependency nonce, held for as long as the dependency list and salt it
-- opens with them. The content pre-digest is not kept: the sealed header
-- is body, pre-commitment, pre-signature, both commitments and the two
-- editions (§8.2, "Verified act"), and nothing after the seal reads it.
--
-- Fresh start: acts formed under the one-nonce handshake verify under
-- none of these formulas, and the dev world is reset at the deploy that
-- carries this migration. A database whose stand-in tables still hold a
-- world is refused before anything changes, so a migrate without the
-- reset fails loudly instead of leaving rows no formula opens.
DO $$
DECLARE
    holding TEXT;
BEGIN
    SELECT string_agg(t, ', ' ORDER BY t) INTO holding FROM (
        SELECT 'l1_host' AS t WHERE EXISTS (SELECT 1 FROM l1_host)
        UNION ALL SELECT 'l1_accounts' WHERE EXISTS (SELECT 1 FROM l1_accounts)
        UNION ALL SELECT 'l1_acts' WHERE EXISTS (SELECT 1 FROM l1_acts)
        UNION ALL SELECT 'l1_act_legs' WHERE EXISTS (SELECT 1 FROM l1_act_legs)
        UNION ALL SELECT 'l1_epochs' WHERE EXISTS (SELECT 1 FROM l1_epochs)
        UNION ALL SELECT 'l1_epoch_ledger' WHERE EXISTS (SELECT 1 FROM l1_epoch_ledger)
        UNION ALL SELECT 'l1_node_state' WHERE EXISTS (SELECT 1 FROM l1_node_state)
        UNION ALL SELECT 'l1_admission_burns' WHERE EXISTS (SELECT 1 FROM l1_admission_burns)
    ) AS held;
    IF holding IS NOT NULL THEN
        RAISE EXCEPTION 'the stand-in tables still hold a world formed under the one-nonce handshake (%)', holding
            USING HINT = 'This migration ships with a fresh start of the dev world: reset the database (make reset-db) and migrate from zero.';
    END IF;
END
$$;

DROP INDEX l1_acts_nonce_once_per_author;

ALTER TABLE l1_acts
    DROP CONSTRAINT l1_acts_handshake_custody,
    DROP CONSTRAINT l1_acts_payload_len_nonnegative,
    DROP CONSTRAINT l1_acts_nonce_digest_length,
    DROP CONSTRAINT l1_acts_held_nonce_is_digested,
    DROP COLUMN payload,
    DROP COLUMN payload_len,
    DROP COLUMN nonce,
    DROP COLUMN nonce_digest;

DROP FUNCTION l1_nonce_digest(TEXT, BYTEA);

ALTER TABLE l1_acts
    ADD COLUMN dependency_nonce BYTEA NOT NULL,
    -- The content salt is host-drawn opening material of the content
    -- commitment: held from seal until acceptance, or until a redaction
    -- drops it from an act that never got there.
    ADD CONSTRAINT l1_acts_content_salt_held_until_acceptance CHECK (
        content_salt IS NOT NULL OR status = 'accepted' OR carriage_dropped_at IS NOT NULL
    );

COMMENT ON COLUMN l1_acts.content_salt IS
    'The host-drawn salt of the content commitment: held from seal until acceptance, then NULL; the carriage layer holds it from the seal on.';
COMMENT ON COLUMN l1_acts.dependency_nonce IS
    'The dependency nonce disclosed with the dependency list; held with the list and the dependency salt for as long as they are held.';
COMMENT ON COLUMN l1_acts.carriage_dropped_at IS
    'When a redaction dropped the content salt of an act that had not reached acceptance.';
