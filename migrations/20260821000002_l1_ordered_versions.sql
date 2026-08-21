-- A landed version row is the promotion of a landed L1 record, so the
-- order of landed versions is the records' order. Ordering them by
-- `created_at` ordered them by CoGra's wall clock instead — a local
-- proxy the graph never attested and a mirror rebuild need not
-- reproduce. Every version table therefore carries the landing
-- coordinates the content entity rows already carry (content_slice.sql):
-- the record's landing epoch and its authoritative causal key, stamped
-- at promotion, rebuildable, never authoritative.
--
-- The coordinates are nullable and all-or-nothing, because three kinds
-- of row have no L1 order to stamp: a pending edit whose record has not
-- landed, a genesis or registration seed that precedes every record,
-- and a row written before this migration. Reads order landed rows on
-- the coordinates and fall back to `(created_at, version_id)` where
-- they are absent — NULLS LAST, so a version that lands settles above
-- every row whose order was only ever a timestamp, and rows without
-- coordinates keep comparing exactly as they did.
--
-- `version_id` is the local monotonic key (20260821000001): the decider
-- inside the pending window, where an epoch that has not closed has no
-- L1 order to consult, and the last tiebreak when two rows share an
-- instant.

-- Profile versions already carry the monotonic key; the current-version
-- index is rebuilt around the landing coordinates.
ALTER TABLE actor_profile_versions
    ADD COLUMN landed_epoch BIGINT,
    ADD COLUMN act_time     BIGINT,
    ADD COLUMN position     BIGINT,
    ADD CONSTRAINT actor_profile_versions_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, act_time, position) IN (0, 3));

DROP INDEX actor_profile_versions_current_idx;
CREATE INDEX actor_profile_versions_current_idx
    ON actor_profile_versions (actor_id,
                               landed_epoch DESC NULLS LAST,
                               act_time     DESC NULLS LAST,
                               position     DESC NULLS LAST,
                               created_at DESC, version_id DESC);

-- Post and comment versions keep `(entity, created_at)` as a UNIQUE
-- constraint when the primary key moves off it: on these two tables
-- `created_at` is one write's pre-commitment instant rather than
-- `now()`, a natural key the pre-sign leg's retry idempotence is an
-- ON CONFLICT on.
--
-- `pending` leads their current-version key because a NULL coordinate
-- says two different things — "the edit has not landed" on a staged
-- row, "written before this migration" on every other — and only the
-- mark tells them apart. Pending versions sort above every landed one
-- (api-spec.md "Pending entries come first"); rows that predate the
-- coordinates sort below, on their timestamp.
ALTER TABLE post_versions
    ADD COLUMN version_id   BIGINT GENERATED ALWAYS AS IDENTITY,
    ADD COLUMN landed_epoch BIGINT,
    ADD COLUMN act_time     BIGINT,
    ADD COLUMN position     BIGINT,
    ADD CONSTRAINT post_versions_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, act_time, position) IN (0, 3));

ALTER TABLE post_versions
    DROP CONSTRAINT post_versions_pkey,
    ADD CONSTRAINT post_versions_pkey PRIMARY KEY (version_id),
    ADD CONSTRAINT post_versions_instant_key UNIQUE (post_id, created_at);

CREATE INDEX post_versions_current_idx
    ON post_versions (post_id, pending DESC,
                      landed_epoch DESC NULLS LAST,
                      act_time     DESC NULLS LAST,
                      position     DESC NULLS LAST,
                      created_at DESC, version_id DESC);

ALTER TABLE comment_versions
    ADD COLUMN version_id   BIGINT GENERATED ALWAYS AS IDENTITY,
    ADD COLUMN landed_epoch BIGINT,
    ADD COLUMN act_time     BIGINT,
    ADD COLUMN position     BIGINT,
    ADD CONSTRAINT comment_versions_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, act_time, position) IN (0, 3));

ALTER TABLE comment_versions
    DROP CONSTRAINT comment_versions_pkey,
    ADD CONSTRAINT comment_versions_pkey PRIMARY KEY (version_id),
    ADD CONSTRAINT comment_versions_instant_key UNIQUE (comment_id, created_at);

CREATE INDEX comment_versions_current_idx
    ON comment_versions (comment_id, pending DESC,
                         landed_epoch DESC NULLS LAST,
                         act_time     DESC NULLS LAST,
                         position     DESC NULLS LAST,
                         created_at DESC, version_id DESC);

-- The remaining version tables carry no pending rows: every row is a
-- promotion or a seed, so the coordinates alone separate ordered fact
-- from fallback.
ALTER TABLE chat_versions
    ADD COLUMN version_id   BIGINT GENERATED ALWAYS AS IDENTITY,
    ADD COLUMN landed_epoch BIGINT,
    ADD COLUMN act_time     BIGINT,
    ADD COLUMN position     BIGINT,
    ADD CONSTRAINT chat_versions_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, act_time, position) IN (0, 3));

ALTER TABLE chat_versions
    DROP CONSTRAINT chat_versions_pkey,
    ADD CONSTRAINT chat_versions_pkey PRIMARY KEY (version_id);

CREATE INDEX chat_versions_current_idx
    ON chat_versions (chat_id,
                      landed_epoch DESC NULLS LAST,
                      act_time     DESC NULLS LAST,
                      position     DESC NULLS LAST,
                      created_at DESC, version_id DESC);

ALTER TABLE chat_message_versions
    ADD COLUMN version_id   BIGINT GENERATED ALWAYS AS IDENTITY,
    ADD COLUMN landed_epoch BIGINT,
    ADD COLUMN act_time     BIGINT,
    ADD COLUMN position     BIGINT,
    ADD CONSTRAINT chat_message_versions_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, act_time, position) IN (0, 3));

ALTER TABLE chat_message_versions
    DROP CONSTRAINT chat_message_versions_pkey,
    ADD CONSTRAINT chat_message_versions_pkey PRIMARY KEY (version_id);

CREATE INDEX chat_message_versions_current_idx
    ON chat_message_versions (chat_message_id,
                              landed_epoch DESC NULLS LAST,
                              act_time     DESC NULLS LAST,
                              position     DESC NULLS LAST,
                              created_at DESC, version_id DESC);

ALTER TABLE item_versions
    ADD COLUMN version_id   BIGINT GENERATED ALWAYS AS IDENTITY,
    ADD COLUMN landed_epoch BIGINT,
    ADD COLUMN act_time     BIGINT,
    ADD COLUMN position     BIGINT,
    ADD CONSTRAINT item_versions_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, act_time, position) IN (0, 3));

ALTER TABLE item_versions
    DROP CONSTRAINT item_versions_pkey,
    ADD CONSTRAINT item_versions_pkey PRIMARY KEY (version_id);

CREATE INDEX item_versions_current_idx
    ON item_versions (item_id,
                      landed_epoch DESC NULLS LAST,
                      act_time     DESC NULLS LAST,
                      position     DESC NULLS LAST,
                      created_at DESC, version_id DESC);

-- The parameter carrier folds over landed finalizations, so the value
-- in force is the one the newest finalization published — the genesis
-- seed is the base case beneath every one of them, which is what
-- NULLS LAST makes it.
ALTER TABLE network_parameter_versions
    ADD COLUMN version_id   BIGINT GENERATED ALWAYS AS IDENTITY,
    ADD COLUMN landed_epoch BIGINT,
    ADD COLUMN act_time     BIGINT,
    ADD COLUMN position     BIGINT,
    ADD CONSTRAINT network_parameter_versions_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, act_time, position) IN (0, 3));

ALTER TABLE network_parameter_versions
    DROP CONSTRAINT network_parameter_versions_pkey,
    ADD CONSTRAINT network_parameter_versions_pkey PRIMARY KEY (version_id);

CREATE INDEX network_parameter_versions_current_idx
    ON network_parameter_versions (parameter,
                                   landed_epoch DESC NULLS LAST,
                                   act_time     DESC NULLS LAST,
                                   position     DESC NULLS LAST,
                                   created_at DESC, version_id DESC);
