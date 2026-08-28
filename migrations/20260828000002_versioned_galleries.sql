-- Versioned galleries: a parent's gallery is keyed on the version row, not
-- the entity row.
--
-- The manifest a content act witnesses is part of the complete content
-- state the winning record renders (post.md §4), so the rendered gallery
-- has to follow the winning version exactly the way the text does. Keyed
-- on the entity, it did not: a pending edit that changed the gallery and
-- then expired rolled the text back to the previous version row and left
-- the new gallery standing, so the reader saw old words with new pictures
-- and the winning record's manifest disagreed with Postgres.
--
-- Keyed on the version, the junction rows are that version's rows and
-- nothing else's. They arrive with it and they go with it, which is what
-- ON DELETE CASCADE says here: the discard path deletes the pending
-- version row and the gallery follows without a statement of its own.
--
-- No data migration: nothing has ever written these tables. The junction
-- write path arrives in this same change, and the only media-aware code
-- before it was the pending sweep's deletes.

ALTER TABLE post_attachments
    DROP CONSTRAINT post_attachments_pkey,
    DROP COLUMN post_id,
    ADD COLUMN post_version_id BIGINT NOT NULL
        REFERENCES post_versions(version_id) ON DELETE CASCADE,
    ADD PRIMARY KEY (post_version_id, attachment_id);

ALTER TABLE comment_attachments
    DROP CONSTRAINT comment_attachments_pkey,
    DROP COLUMN comment_id,
    ADD COLUMN comment_version_id BIGINT NOT NULL
        REFERENCES comment_versions(version_id) ON DELETE CASCADE,
    ADD PRIMARY KEY (comment_version_id, attachment_id);

-- The reverse index the junction design is justified by: "find all parents
-- using attachment X" (data-model.md "Why parents point at attachments"),
-- which ownership tracing on redaction walks and which every
-- media_attachments delete performs as its foreign-key check. The primary
-- key leads with the parent, Postgres 16 has no index skip scan, and no
-- index is created behind a foreign key — so without these the lookup and
-- the FK check are both sequential scans.
--
-- Only the two junctions this slice writes. Chats and items get theirs in
-- their own slices, with their own write paths to measure them against.
CREATE INDEX post_attachments_attachment_idx
    ON post_attachments (attachment_id);
CREATE INDEX comment_attachments_attachment_idx
    ON comment_attachments (attachment_id);
