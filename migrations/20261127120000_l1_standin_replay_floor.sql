-- The stand-in publishes every accepted act at the replay floor, and every
-- epoch package binds the verification-case declarations in force
-- (layer1-interface.md §8.4, "Act envelope"; §11.6, the published epoch
-- package). Owned by the l1-standin crate and dropped at the swap with the
-- rest of the l1_* set.
--
-- An accepted act's published record carries its approval witness, so an
-- act past approval holds one for good. The one statement that approves an
-- act writes the witness with it and nothing clears it, so every existing
-- world already satisfies this; a world that does not cannot publish its
-- accepted acts at the floor and is refused before anything changes.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM l1_acts WHERE status <> 'sealed' AND approval_signature IS NULL) THEN
        RAISE EXCEPTION 'the stand-in holds an approved or accepted act without its approval witness'
            USING HINT = 'Its published record cannot carry the approval witness; the world cannot be published at the replay floor as it stands.';
    END IF;
END
$$;

ALTER TABLE l1_acts
    ADD CONSTRAINT l1_acts_approved_holds_witness
        CHECK (status = 'sealed' OR approval_signature IS NOT NULL);

-- The verification-case declarations each closed epoch bound, by identity
-- and edition. An epoch with no row bound the empty set. The deployment
-- declares no case, so every epoch closed so far, and every epoch it
-- closes, binds the empty set.
CREATE TABLE l1_epoch_case_declarations (
    epoch    BIGINT  NOT NULL REFERENCES l1_epochs (epoch),
    identity TEXT    NOT NULL,
    edition  INTEGER NOT NULL,
    PRIMARY KEY (epoch, identity)
);
