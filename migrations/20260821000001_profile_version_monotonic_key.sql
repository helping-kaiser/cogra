-- Profile versions keyed on (actor_id, created_at): two writes sharing one
-- instant collide on the key, and the ambiguity is not hypothetical —
-- `now()` is the transaction timestamp, so two version rows written in one
-- transaction always carry the same created_at. An identity column gives
-- the table a monotonic key of its own: unique per row, assigned in write
-- order, so "newest wins" stays decidable when the instants tie.
--
-- Reads order on (created_at DESC, version_id DESC), not version_id alone.
-- ADD COLUMN numbers the existing rows in physical order, which need not
-- follow created_at, while the old key guaranteed those rows no ties at
-- all — keeping created_at first leaves every historical read exactly as
-- it was and lets the tiebreaker decide only the collisions it was added
-- for. The index carries the tiebreaker so the read stays index-served.

ALTER TABLE actor_profile_versions
    ADD COLUMN version_id BIGINT GENERATED ALWAYS AS IDENTITY;

ALTER TABLE actor_profile_versions
    DROP CONSTRAINT actor_profile_versions_pkey,
    ADD CONSTRAINT actor_profile_versions_pkey PRIMARY KEY (version_id);

CREATE INDEX actor_profile_versions_current_idx
    ON actor_profile_versions (actor_id, created_at DESC, version_id DESC);
