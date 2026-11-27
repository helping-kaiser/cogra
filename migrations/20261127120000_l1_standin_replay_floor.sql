-- The stand-in publishes every accepted act at the replay floor, every
-- epoch states the approval form its witnesses verify in, and every epoch
-- package binds the verification-case declarations in force
-- (layer1-interface.md §8.4, "Act envelope"; §11.6, the published epoch
-- package). Owned by the l1-standin crate and dropped at the swap with the
-- rest of the l1_* set.
--
-- Approval forms: 1, the approval over the encoded verified act and its
-- host seal; 2, the approval over the act alone. Every epoch closed before
-- this migration was closed in form 1, so the epoch column fills with 1 and
-- then loses its default: every later close states its form.
ALTER TABLE l1_epochs
    ADD COLUMN approval_form SMALLINT NOT NULL DEFAULT 1
        CONSTRAINT l1_epochs_approval_form_known CHECK (approval_form IN (1, 2));
ALTER TABLE l1_epochs ALTER COLUMN approval_form DROP DEFAULT;

-- The form each act's approval was taken in — the host's own bookkeeping,
-- never published per act: the close orders acts of one form into an
-- epoch, so an act approved in form 1 that no epoch has accepted yet keeps
-- its approval and lands in an epoch of form 1. Every act past approval
-- was approved in form 1; a sealed act has none yet.
ALTER TABLE l1_acts ADD COLUMN approval_form SMALLINT;
UPDATE l1_acts SET approval_form = 1 WHERE status <> 'sealed';

-- Whether the host sealed the act before the approval covered the act
-- alone: such an act also takes an approval in form 1, so a witness its
-- author signed before this migration — a held admission approval among
-- them — stays good, and the act lands in an epoch of form 1. Every act
-- in the table now was sealed before; an act sealed later takes form 2
-- only. CoGra's staged writes carry the same mark
-- (20261127120002_staged_sealed_before_switch).
ALTER TABLE l1_acts ADD COLUMN sealed_before_switch BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE l1_acts SET sealed_before_switch = TRUE;

-- An accepted act's published record carries its approval witness, so an
-- act past approval holds one for good, and the form it was taken in. The
-- one statement that approves an act writes both with it and nothing
-- clears them, so every world the stand-in wrote satisfies this.
ALTER TABLE l1_acts
    ADD CONSTRAINT l1_acts_approved_holds_witness
        CHECK (status = 'sealed' OR approval_signature IS NOT NULL),
    ADD CONSTRAINT l1_acts_approval_form_known CHECK (
        (status = 'sealed' AND approval_form IS NULL)
        OR (status <> 'sealed' AND approval_form IN (1, 2)));

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
