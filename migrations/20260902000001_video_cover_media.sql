-- The video poster as a real foreign key on the asset row.
--
-- An asset pointing at another asset is what makes the poster redactable
-- with its video: the removal cascade can see the link, so removing a
-- video is never a poster left serving bytes for content that is gone.
-- The junction-side is_cover answers a different question — which
-- attachment leads a multi-asset parent — and stays where it is.

ALTER TABLE media_attachments
    -- Nullable because most assets are not videos and a video need not
    -- carry a poster to exist. NO ACTION (the default) rather than a
    -- cascade: rows here are never deleted in a normal flow — redaction
    -- removes bytes and leaves the mark — so a delete that would orphan
    -- a poster reference is a bug worth refusing loudly.
    ADD COLUMN cover_media_id UUID REFERENCES media_attachments(id),
    -- A row cannot be its own poster. Deeper cycles (A covers B, B covers
    -- A) are not expressible in a row-local CHECK and are refused by the
    -- service layer that writes the column.
    ADD CONSTRAINT media_attachments_cover_not_self
        CHECK (cover_media_id IS NULL OR cover_media_id <> id);

-- The reverse direction — "which video does this poster serve?" — that
-- the removal cascade walks and that every media_attachments delete
-- performs as its foreign-key check. Postgres creates no index behind a
-- foreign key, so without this both are sequential scans; the same
-- reasoning the junction tables' attachment indexes carry.
CREATE INDEX media_attachments_cover_media_idx
    ON media_attachments (cover_media_id)
    WHERE cover_media_id IS NOT NULL;
