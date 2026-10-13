-- The release registry carries each release's notes and always names its
-- public page (api-spec.md "Application versions"; data-model.md
-- "Application registry"): What's new draws every release's notes in its
-- card and ends every card in the release's GitHub door.
--
-- Safe on every environment: nothing has written `versions` before this
-- migration, so the table is empty. The DEFAULT only bridges the ADD;
-- the CHECK refuses an empty-notes row from here on.
ALTER TABLE versions
    ADD COLUMN notes TEXT[] NOT NULL DEFAULT '{}',
    ALTER COLUMN patch_notes_url SET NOT NULL;
ALTER TABLE versions ALTER COLUMN notes DROP DEFAULT;
ALTER TABLE versions
    ADD CONSTRAINT versions_notes_present CHECK (cardinality(notes) >= 1);
