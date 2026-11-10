-- CoGra's half of numbering epochs and positions from 1, the stand-in's
-- own tables having moved in the migration before this one.
--
-- Epochs number certificates from 1 and positions number the acts of one
-- epoch from 1 to |Q_k|; boundary 0 is the empty state before epoch 1
-- (layer1-interface.md §7.2 "Title Certificate", §8.3, §11.6). Every
-- stored epoch and position moves up by one, in one transaction, so the
-- order of every key and every distance between epochs stay what they
-- were.
--
-- The mirror is shifted in place rather than rebuilt: the copies of the
-- order key in posts, comments and the version tables are stamped at
-- promotion and never re-stamped by a rebuild, and media_live_placed joins
-- them to mirror rows on equality — so the mirror and every copy move in
-- lock step. A rebuild from the published sequence afterwards reproduces
-- the shifted mirror row for row. The cursor moves too: -1, "nothing
-- ingested", becomes the boundary 0. staged_writes holds cursor readings
-- that the GC compares with the cursor, so they move with it and every
-- GC distance holds.

-- mirror_epochs.epoch is a primary key, checked row by row during an
-- UPDATE (PostgreSQL CREATE TABLE, "Non-deferred uniqueness
-- constraints"), so a plain +1 can collide with a row not yet moved.
-- Negating first puts every intermediate value below every unmoved one.
UPDATE mirror_epochs SET epoch = -epoch - 1;
UPDATE mirror_epochs SET epoch = -epoch;

UPDATE mirror_records SET epoch = epoch + 1, position = position + 1;
UPDATE mirror_record_legs SET epoch = epoch + 1, position = position + 1;
UPDATE mirror_epoch_cursor SET last_epoch = last_epoch + 1;

-- The order-key copies. A pending row holds none (all three NULL), and
-- NULL + 1 stays NULL, so only landed rows move.
UPDATE posts SET landed_epoch = landed_epoch + 1, position = position + 1
 WHERE landed_epoch IS NOT NULL;
UPDATE comments SET landed_epoch = landed_epoch + 1, position = position + 1
 WHERE landed_epoch IS NOT NULL;
UPDATE actor_profile_versions SET landed_epoch = landed_epoch + 1, position = position + 1
 WHERE landed_epoch IS NOT NULL;
UPDATE post_versions SET landed_epoch = landed_epoch + 1, position = position + 1
 WHERE landed_epoch IS NOT NULL;
UPDATE comment_versions SET landed_epoch = landed_epoch + 1, position = position + 1
 WHERE landed_epoch IS NOT NULL;
UPDATE chat_versions SET landed_epoch = landed_epoch + 1, position = position + 1
 WHERE landed_epoch IS NOT NULL;
UPDATE chat_message_versions SET landed_epoch = landed_epoch + 1, position = position + 1
 WHERE landed_epoch IS NOT NULL;
UPDATE item_versions SET landed_epoch = landed_epoch + 1, position = position + 1
 WHERE landed_epoch IS NOT NULL;
UPDATE network_parameter_versions SET landed_epoch = landed_epoch + 1, position = position + 1
 WHERE landed_epoch IS NOT NULL;

UPDATE staged_writes SET prepared_epoch = prepared_epoch + 1;
UPDATE staged_writes SET expired_epoch = expired_epoch + 1
 WHERE expired_epoch IS NOT NULL;

-- The mirror ingests nothing without an order of record: no epoch 0, no
-- position 0, and no (epoch, position) twice.
ALTER TABLE mirror_records
    ADD CONSTRAINT mirror_records_numbered_from_one CHECK (epoch >= 1 AND position >= 1),
    ADD CONSTRAINT mirror_records_order_of_record_key UNIQUE (epoch, position);
ALTER TABLE mirror_record_legs
    ADD CONSTRAINT mirror_record_legs_numbered_from_one CHECK (epoch >= 1 AND position >= 1);
ALTER TABLE mirror_epochs
    ADD CONSTRAINT mirror_epochs_numbered_from_one CHECK (epoch >= 1);
ALTER TABLE mirror_epoch_cursor
    ADD CONSTRAINT mirror_epoch_cursor_from_boundary CHECK (last_epoch >= 0);

-- The copies carry the mirror's numbering.
ALTER TABLE posts
    ADD CONSTRAINT posts_numbered_from_one CHECK (landed_epoch >= 1 AND position >= 1);
ALTER TABLE comments
    ADD CONSTRAINT comments_numbered_from_one CHECK (landed_epoch >= 1 AND position >= 1);
ALTER TABLE actor_profile_versions
    ADD CONSTRAINT actor_profile_versions_numbered_from_one CHECK (landed_epoch >= 1 AND position >= 1);
ALTER TABLE post_versions
    ADD CONSTRAINT post_versions_numbered_from_one CHECK (landed_epoch >= 1 AND position >= 1);
ALTER TABLE comment_versions
    ADD CONSTRAINT comment_versions_numbered_from_one CHECK (landed_epoch >= 1 AND position >= 1);
ALTER TABLE chat_versions
    ADD CONSTRAINT chat_versions_numbered_from_one CHECK (landed_epoch >= 1 AND position >= 1);
ALTER TABLE chat_message_versions
    ADD CONSTRAINT chat_message_versions_numbered_from_one CHECK (landed_epoch >= 1 AND position >= 1);
ALTER TABLE item_versions
    ADD CONSTRAINT item_versions_numbered_from_one CHECK (landed_epoch >= 1 AND position >= 1);
ALTER TABLE network_parameter_versions
    ADD CONSTRAINT network_parameter_versions_numbered_from_one CHECK (landed_epoch >= 1 AND position >= 1);

ALTER TABLE staged_writes
    ADD CONSTRAINT staged_writes_epochs_from_boundary
        CHECK (prepared_epoch >= 0 AND expired_epoch >= 0);

COMMENT ON COLUMN mirror_epoch_cursor.last_epoch IS
    'The last fully-ingested epoch; 0, the empty boundary, before the first.';
