-- Alt text is a fact about the placement, not about the asset.
--
-- A description is not the asset's to hold: it rides the payload envelope
-- and the junction row caches it per version, so writing or correcting one
-- is a new version of the parent and the bytes never move again
-- (data-model.md "Media attachments"). That is what lets a picture upload
-- the moment it is picked — nothing about the upload waits on a
-- description, and no description forces a re-upload.
--
-- Three statements in this order, and the order is the point: the columns
-- that will hold the value exist before the value is copied, and the
-- column that holds it today is dropped only after the copy.

ALTER TABLE post_attachments    ADD COLUMN alt_text TEXT;
ALTER TABLE comment_attachments ADD COLUMN alt_text TEXT;

-- Copy forward, onto every junction row rather than only the current
-- versions'. The asset row is what every gallery read resolves alt text
-- from today, superseded versions included, so copying it everywhere is
-- what makes this migration invisible to a reader: the description each
-- version renders after it is exactly the one it rendered before.
--
-- Copying only to current versions would not preserve less, it would
-- change more — a superseded version that reads a description today would
-- read none tomorrow. "Never erase silently" is the rule this obeys.
--
-- What is genuinely not recoverable here is what an *older* version's
-- manifest witnessed before the description was last edited. That value
-- lives in the witnessed payload, not in Postgres, and this statement does
-- not claim to reconstruct it; the record remains the published statement
-- either way.
UPDATE post_attachments j
   SET alt_text = m.alt_text
  FROM media_attachments m
 WHERE m.id = j.attachment_id
   AND m.alt_text IS NOT NULL;

UPDATE comment_attachments j
   SET alt_text = m.alt_text
  FROM media_attachments m
 WHERE m.id = j.attachment_id
   AND m.alt_text IS NOT NULL;

ALTER TABLE media_attachments DROP COLUMN alt_text;
