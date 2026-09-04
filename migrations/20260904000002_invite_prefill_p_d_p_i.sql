-- The invite prefill under the uniform two-parameter grammar.
--
-- Every user-parameter pair the schema carries is `(p_d, p_i)` at
-- DOUBLE PRECISION — mirror_record_legs, staged_writes — because that is
-- the pair every record carries and f64 is what the Rust side holds.
-- The prefill was the one pair stored at REAL under a fourth spelling,
-- so a write narrowed the value and the read widened a different number
-- back.
--
-- Widening does not recover what the narrow column already rounded off;
-- rows written before this migration keep the value REAL could hold.

ALTER TABLE auth_invite_links
    ALTER COLUMN prefill_dim1 TYPE DOUBLE PRECISION,
    ALTER COLUMN prefill_dim2 TYPE DOUBLE PRECISION;

ALTER TABLE auth_invite_links RENAME COLUMN prefill_dim1 TO prefill_p_d;
ALTER TABLE auth_invite_links RENAME COLUMN prefill_dim2 TO prefill_p_i;

ALTER TABLE auth_invite_links
    RENAME CONSTRAINT auth_invite_links_prefill_dim1_check
                   TO auth_invite_links_prefill_p_d_check;
ALTER TABLE auth_invite_links
    RENAME CONSTRAINT auth_invite_links_prefill_dim2_check
                   TO auth_invite_links_prefill_p_i_check;
