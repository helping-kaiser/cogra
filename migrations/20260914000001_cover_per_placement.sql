-- A video's poster is a fact about the placement, not about the asset.
--
-- A cover is not the clip's to hold: it rides the payload envelope's
-- manifest entry (per-asset map key 3) and the junction row caches it per
-- version, so naming a different poster is a new version of the parent and
-- the clip's bytes never move again (data-model.md "Media attachments").
-- A video post is one standalone video and one standalone image, and the
-- placement is where the two are tied together.
--
-- Four statements in this order, and the order is the point: the columns
-- that will hold the value exist before the value is copied, the indexes
-- the orphan sweep probes through exist before the sweep can reach the new
-- reference, and the column that holds it today is dropped only after the
-- copy.

ALTER TABLE post_attachments
    ADD COLUMN cover_media_id UUID REFERENCES media_attachments(id),
    -- A placement cannot be its own poster. Deeper cycles are not
    -- expressible in a row-local CHECK and are refused by the service
    -- layer that writes the column, exactly as the asset-side check did.
    ADD CONSTRAINT post_attachments_cover_not_self
        CHECK (cover_media_id IS NULL OR cover_media_id <> attachment_id);

ALTER TABLE comment_attachments
    ADD COLUMN cover_media_id UUID REFERENCES media_attachments(id),
    ADD CONSTRAINT comment_attachments_cover_not_self
        CHECK (cover_media_id IS NULL OR cover_media_id <> attachment_id);

-- Copy forward, onto every junction row rather than only the current
-- versions'. The asset row is what every gallery read resolves the poster
-- from today, superseded versions included, so copying it everywhere is
-- what makes this migration invisible to a reader: the cover each version
-- renders after it is exactly the one it rendered before.
--
-- Copying only to current versions would not preserve less, it would
-- change more — a superseded version that shows a poster today would show
-- none tomorrow. "Never erase silently" is the rule this obeys.
--
-- The asset-side CHECK already refused a self-poster, so no row copied
-- here can violate the placement-side one.
UPDATE post_attachments j
   SET cover_media_id = m.cover_media_id
  FROM media_attachments m
 WHERE m.id = j.attachment_id
   AND m.cover_media_id IS NOT NULL;

UPDATE comment_attachments j
   SET cover_media_id = m.cover_media_id
  FROM media_attachments m
 WHERE m.id = j.attachment_id
   AND m.cover_media_id IS NOT NULL;

-- The reverse direction the orphan sweep walks — "which placement uses
-- this asset as its poster?" — and the path PostgreSQL takes for its own
-- foreign-key re-check on every media_attachments delete. The reference
-- moved from one column to two, so the probe did too, and a probe owes its
-- column an index in the same change (postgres-store `media::sweep_orphans`).
-- Partial for the reason the asset-side index was: the column is null on
-- every placement that is not a covered clip, and both the probe and the
-- re-check only ever look for a value.
CREATE INDEX post_attachments_cover_media_idx
    ON post_attachments (cover_media_id)
    WHERE cover_media_id IS NOT NULL;
CREATE INDEX comment_attachments_cover_media_idx
    ON comment_attachments (cover_media_id)
    WHERE cover_media_id IS NOT NULL;

-- Dropping the column takes media_attachments_cover_media_idx and the
-- asset-side not-self CHECK with it.
ALTER TABLE media_attachments DROP COLUMN cover_media_id;
