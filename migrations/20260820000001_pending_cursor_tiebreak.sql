-- The pending branch of a listing keysets on the authoring instant, and
-- two writes can share one: `created_at` is the pre-commitment signature
-- instant, and nothing serializes two authors' signatures apart. A
-- keyset on a non-unique column loses rows at the page boundary — the
-- exclusive cursor skips every same-instant sibling — so the pending
-- branch orders and compares on `(created_at, id)`, the entity's own id
-- breaking the tie. The indexes carry the tiebreaker so the walk stays
-- index-served.

DROP INDEX posts_pending_idx;
DROP INDEX comments_pending_idx;

CREATE INDEX posts_pending_idx
    ON posts (created_at DESC, id DESC) WHERE landed_epoch IS NULL;
CREATE INDEX comments_pending_idx
    ON comments (target_id, created_at DESC, id DESC) WHERE landed_epoch IS NULL;
