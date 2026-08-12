-- Slice 2 — Content (data-model.md "Content nodes", "The payload
-- envelope", "Act payload carriage"): the graph linkage and listing-order
-- columns on the display entity rows, and the carriage table that takes
-- over permanent payload storage from the staged row at confirm.

-- The display row's binding to its minted L1 node
-- (mint:act:<author>:<seq>:<family>, stored verbatim), written at
-- confirm. The row's UUID also rides the payload envelope's guild map,
-- so the L1 payload witness proves this binding — the column is a
-- verified cache of a fact the graph attests, same class as
-- comments.target_id. The landing-order columns cache the genesis
-- record's authoritative causal key for the chronological listings;
-- wall-clock created_at is display-only (graph-model.md §2).
ALTER TABLE posts
    ADD COLUMN l1_node_id   TEXT   NOT NULL UNIQUE,
    ADD COLUMN landed_epoch BIGINT NOT NULL,
    ADD COLUMN act_time     BIGINT NOT NULL,
    ADD COLUMN position     BIGINT NOT NULL;
CREATE INDEX posts_landing_order_idx ON posts (landed_epoch DESC, act_time DESC, position DESC);

ALTER TABLE comments
    ADD COLUMN l1_node_id   TEXT   NOT NULL UNIQUE,
    ADD COLUMN landed_epoch BIGINT NOT NULL,
    ADD COLUMN act_time     BIGINT NOT NULL,
    ADD COLUMN position     BIGINT NOT NULL;
-- Thread reads list a target's comments oldest-first in landing order.
CREATE INDEX comments_target_order_idx
    ON comments (target_id, landed_epoch, act_time, position);

-- Act payload carriage (layer1-interface.md §8.4, layers.md §5): the
-- envelope bytes and the private value ("salt") behind the L1 content
-- commitment. Carriage is the bytes' only home — the mirror stores only
-- the witness — and rows are promoted here from the staged write at
-- confirm. Payload state moves toward 'reduced' only; removal empties
-- the bytes and salt atomically (the erasure slice) and the row itself
-- is never deleted.
CREATE TABLE act_payloads (
    act_id        TEXT        PRIMARY KEY,  -- L1 act identifier, verbatim
    payload       BYTEA       NOT NULL,
    content_salt  BYTEA       NOT NULL,
    payload_state TEXT        NOT NULL DEFAULT 'full'
        CHECK (payload_state IN ('full', 'reduced')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
