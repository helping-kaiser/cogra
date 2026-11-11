-- The boundary triple each epoch closed under. Owned by the l1-standin
-- crate and dropped at the swap with the rest of the l1_* set.
--
-- The epoch package carries the epoch target size and the minimum and
-- maximum durations (layer1-interface.md §5 host contract (vi); §11.6,
-- "Final-set closure"). The stand-in's target is its act budget, its
-- minimum 0 (it closes only on its clock, never early on a filled target),
-- and its maximum the clock's interval in seconds — NULL where no clock
-- ran and the epoch closed when the host was asked to.
--
-- An epoch closes on the clock whether or not anything is orderable, so a
-- row may hold zero acts; no constraint on l1_epochs or l1_epoch_ledger
-- refuses one (an empty epoch has no ledger line).
--
-- History: every epoch closed before this migration ran under the act
-- budget 10_000 and no minimum; the clock it ran under was never
-- recorded, so its maximum stays NULL.

ALTER TABLE l1_epochs
    ADD COLUMN target_acts       BIGINT,
    ADD COLUMN min_duration_secs BIGINT,
    ADD COLUMN max_duration_secs BIGINT;

UPDATE l1_epochs SET target_acts = 10000, min_duration_secs = 0;

ALTER TABLE l1_epochs
    ALTER COLUMN target_acts SET NOT NULL,
    ALTER COLUMN min_duration_secs SET NOT NULL,
    ADD CONSTRAINT l1_epochs_target_positive CHECK (target_acts > 0),
    ADD CONSTRAINT l1_epochs_durations_ordered CHECK (
        min_duration_secs >= 0 AND (max_duration_secs IS NULL OR max_duration_secs > 0)
        AND (max_duration_secs IS NULL OR max_duration_secs >= min_duration_secs)),
    ADD CONSTRAINT l1_epochs_act_count_within_target CHECK (
        act_count >= 0 AND act_count <= target_acts);
