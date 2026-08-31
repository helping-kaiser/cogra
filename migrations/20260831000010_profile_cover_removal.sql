-- The profile carries ONE image. The cover slot is removed from the
-- contract, the payload envelope (guild key 12, retired), and here.
--
-- The word "cover" survives elsewhere and means something else: the
-- video poster that arrives with 2.5.2, and the lead image of a gallery
-- (the junction-side `is_cover`). Neither is touched.
--
-- Dropping a column drops what it held, so this refuses to run where it
-- would erase a cover somebody set — "never erase silently" applies to
-- migrations too. On the only deployment that exists the column is
-- entirely NULL (8 profile version rows, 0 covers, verified before this
-- migration was written), so the guard passes and nothing is lost.

DO $$
DECLARE
    held BIGINT;
BEGIN
    SELECT count(cover_id) INTO held FROM actor_profile_versions;
    IF held > 0 THEN
        RAISE EXCEPTION
            'actor_profile_versions.cover_id holds % non-null value(s); '
            'dropping it here would erase them without a mark. Migrate '
            'that data deliberately before removing the column.', held;
    END IF;
END
$$;

ALTER TABLE actor_profile_versions
    DROP COLUMN cover_id;
