-- Whether a video's poster was chosen by its author or taken from the clip
-- is a fact about the placement, like the poster itself.
--
-- It rides the payload envelope's manifest entry beside the cover it
-- describes (per-asset map key 4, present only alongside key 3), and the
-- junction row caches it per version the way it caches the cover
-- (data-model.md "Media attachments"), so a read serves it without
-- decoding a payload.
--
-- FALSE for every existing row, which is what those rows' manifests say:
-- none of them carries key 4, and an absent mark reads as a chosen cover.
-- Nothing is copied forward because there is nothing to copy.

ALTER TABLE post_attachments
    ADD COLUMN cover_taken BOOLEAN NOT NULL DEFAULT FALSE,
    -- The mark qualifies a cover, so it cannot outlive one: the manifest
    -- refuses key 4 without key 3, and the row refuses the same shape.
    ADD CONSTRAINT post_attachments_cover_taken_needs_cover
        CHECK (NOT cover_taken OR cover_media_id IS NOT NULL);

ALTER TABLE comment_attachments
    ADD COLUMN cover_taken BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT comment_attachments_cover_taken_needs_cover
        CHECK (NOT cover_taken OR cover_media_id IS NOT NULL);
