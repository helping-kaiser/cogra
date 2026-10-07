-- Acts carried with an application (auth.md "Application"; seam 099
-- rulings 68, 70, 73): the post, Opinion and Affinity an applicant stages
-- once each are held by the server — in custody whatever becomes of the
-- application, author-only, surviving the loss of the device — and sign
-- at the account's landing as one automatic batch, each depending on the
-- admission Registration and the winning vouch.
--
-- A carried act is an ordinary staged write in the `carried` state: its
-- proposal is whole but for the two landing dependencies, which nobody
-- can know before the landing. The landing appends them and moves the
-- write to `awaiting_pre_sign`; `carried` stays true, so the device's
-- poll can tell the batch it signs without a prompt from a write its
-- author is signing by hand.
ALTER TABLE staged_writes DROP CONSTRAINT staged_writes_state_check;
ALTER TABLE staged_writes ADD CONSTRAINT staged_writes_state_check
    CHECK (state IN ('carried', 'awaiting_pre_sign', 'sealing', 'awaiting_approval',
                     'relaying', 'landed', 'expired'));
ALTER TABLE staged_writes ADD COLUMN carried BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX staged_writes_carried_idx
    ON staged_writes (actor_id) WHERE state = 'carried';
