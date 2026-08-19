-- Pending content (substrate.md §6; architecture.md "The write path"):
-- a prepared record is its author's content from the pre-commitment
-- signature onward, so its display rows exist from that moment and
-- carry a pending mark until confirm. The rows are ordinary display
-- rows — the content is real; only its place in the order is not.
--
-- The mark on an entity row is the absence of landing coordinates: a
-- pending write has no causal key yet, which is exactly SQL NULL. The
-- listing indexes are declared DESC, and DESC implies NULLS FIRST, so
-- pending entries sort ahead of the newest landed entry without a new
-- sort key. A version row carries no coordinates of its own, so an
-- unlanded edit needs an explicit flag instead.
--
-- Pending rows are L2-operational, like the staged row they belong to:
-- when a prepared act expires unlanded, its pending rows are deleted
-- with it and nothing is left behind — on the graph nothing ever
-- existed, so there is nothing to mark (substrate.md §6). No graph
-- structure is engaged: a pending item has no record yet.

ALTER TABLE posts
    ALTER COLUMN landed_epoch DROP NOT NULL,
    ALTER COLUMN act_time     DROP NOT NULL,
    ALTER COLUMN position     DROP NOT NULL,
    ADD CONSTRAINT posts_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, act_time, position) IN (0, 3));

ALTER TABLE comments
    ALTER COLUMN landed_epoch DROP NOT NULL,
    ALTER COLUMN act_time     DROP NOT NULL,
    ALTER COLUMN position     DROP NOT NULL,
    ADD CONSTRAINT comments_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, act_time, position) IN (0, 3));

-- The pending branch of each listing walks its own partial index,
-- keyed by the authoring instant (created_at is the pre-commitment
-- signature instant from this migration on). Thread reads list a
-- target's comments newest-first in landing order, pending first.
CREATE INDEX posts_pending_idx
    ON posts (created_at DESC) WHERE landed_epoch IS NULL;
CREATE INDEX comments_pending_idx
    ON comments (target_id, created_at DESC) WHERE landed_epoch IS NULL;

-- An unlanded edit's version row: the new text shows immediately,
-- marked pending, and is deleted if the edit expires — the display
-- then falls back to the previous version. Every row written before
-- this migration was written at confirm, so FALSE is the true backfill.
ALTER TABLE post_versions
    ADD COLUMN pending BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE comment_versions
    ADD COLUMN pending BOOLEAN NOT NULL DEFAULT FALSE;

-- The staged row's link to the display rows it owns while pending:
-- node_id is the L2 UUID the payload envelope already carries (the
-- display row's own id), recorded at prepare so expiry can find the
-- rows without decoding CBOR. pre_signed_at is the authoring instant
-- the content dates from — createdAt resolves from it, pending and
-- landed alike, so the date never jumps when an item lands.
ALTER TABLE staged_writes
    ADD COLUMN node_id       UUID,
    ADD COLUMN pre_signed_at TIMESTAMPTZ;
CREATE INDEX staged_writes_node_idx
    ON staged_writes (node_id) WHERE node_id IS NOT NULL;
