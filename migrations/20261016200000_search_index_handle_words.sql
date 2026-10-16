-- Plain text matches a handle by word prefix (api-spec.md "Search", "Plain
-- text"; PR-93): "gen" finds @genesis, "enesis" finds nothing — the same
-- full-text shape titles and display names match by, so `@prefix` stays
-- the one deliberate handle cue. A handle's words are what the `simple`
-- parser makes of it: `pixel_joiner` holds `pixel` and `joiner`.
--
-- `words` therefore covers handles too. As in migration
-- `search_index_unified_law`, a generated column's expression cannot be
-- altered in place before PostgreSQL 17 (ALTER COLUMN ... SET EXPRESSION),
-- and the dev stacks run 16 and 18, so the column is dropped and added
-- again — its partial indexes go with it and are created again, with one
-- more for the handle field.

ALTER TABLE search_index DROP COLUMN words;
ALTER TABLE search_index ADD COLUMN words TSVECTOR GENERATED ALWAYS AS (
    CASE WHEN field IN ('title', 'display_name', 'handle')
         THEN to_tsvector('simple'::regconfig, value)
    END
) STORED;

CREATE INDEX search_index_titles_fts
    ON search_index USING gin (words)
    WHERE field = 'title';
CREATE INDEX search_index_display_names_fts
    ON search_index USING gin (words)
    WHERE field = 'display_name';
CREATE INDEX search_index_handles_fts
    ON search_index USING gin (words)
    WHERE field = 'handle';
