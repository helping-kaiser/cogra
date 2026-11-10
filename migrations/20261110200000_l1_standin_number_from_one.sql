-- The stand-in's half of numbering epochs and positions from 1. Owned by
-- the l1-standin crate and dropped at the swap with the rest of the l1_*
-- set; CoGra's own copies shift in the migration after this one.
--
-- Epochs number certificates from 1 and positions number the acts of one
-- epoch from 1 to |Q_k|; boundary 0 is the empty state before epoch 1
-- (layer1-interface.md §7.2 "Title Certificate", §8.3, §11.6). Every
-- stored epoch and position moves up by one, so the order and every
-- distance between epochs stay what they were. An admission burn's
-- epochs move with them: the delay it waits is a distance, and "-1
-- before any close" becomes the boundary 0.

-- l1_epochs.epoch is a primary key, checked row by row during an UPDATE
-- (PostgreSQL CREATE TABLE, "Non-deferred uniqueness constraints"), so a
-- plain +1 can collide with a row not yet moved. Negating first puts every
-- intermediate value below every unmoved one.
UPDATE l1_epochs SET epoch = -epoch - 1;
UPDATE l1_epochs SET epoch = -epoch;

UPDATE l1_acts SET epoch = epoch + 1, position = position + 1
 WHERE epoch IS NOT NULL;

UPDATE l1_admission_burns
   SET requested_epoch = requested_epoch + 1,
       settles_after_epoch = settles_after_epoch + 1;

ALTER TABLE l1_epochs
    ADD CONSTRAINT l1_epochs_numbered_from_one CHECK (epoch >= 1);

-- An accepted act has an epoch and a position, both from 1, and no two
-- accepted acts share an (epoch, position): a repeat or an epoch 0 has no
-- order of record.
ALTER TABLE l1_acts
    ADD CONSTRAINT l1_acts_numbered_from_one CHECK (epoch >= 1 AND position >= 1);
CREATE UNIQUE INDEX l1_acts_order_of_record_key
    ON l1_acts (epoch, position) WHERE status = 'accepted';

ALTER TABLE l1_admission_burns
    ADD CONSTRAINT l1_admission_burns_epochs_from_boundary
        CHECK (requested_epoch >= 0 AND settles_after_epoch >= requested_epoch);

COMMENT ON COLUMN l1_admission_burns.requested_epoch IS
    'The last closed epoch at request; 0, the empty boundary, before the first close.';
