-- A landed display row carries its record's key of record
-- (layer1-interface.md §8.3): the pair (landed_epoch, position), which
-- every ordering read and every join to the mirror uses. The act time is
-- the published record's own summary and lives with it in
-- mirror_records; the display rows' stamped copy is dropped, and each
-- table's completeness check covers the two coordinates that remain —
-- both or neither, NULL being the pending or unordered row.

ALTER TABLE posts
    DROP CONSTRAINT posts_landing_order_complete,
    DROP COLUMN act_time,
    ADD CONSTRAINT posts_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, position) IN (0, 2));

ALTER TABLE comments
    DROP CONSTRAINT comments_landing_order_complete,
    DROP COLUMN act_time,
    ADD CONSTRAINT comments_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, position) IN (0, 2));

ALTER TABLE post_versions
    DROP CONSTRAINT post_versions_landing_order_complete,
    DROP COLUMN act_time,
    ADD CONSTRAINT post_versions_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, position) IN (0, 2));

ALTER TABLE comment_versions
    DROP CONSTRAINT comment_versions_landing_order_complete,
    DROP COLUMN act_time,
    ADD CONSTRAINT comment_versions_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, position) IN (0, 2));

ALTER TABLE actor_profile_versions
    DROP CONSTRAINT actor_profile_versions_landing_order_complete,
    DROP COLUMN act_time,
    ADD CONSTRAINT actor_profile_versions_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, position) IN (0, 2));

ALTER TABLE chat_versions
    DROP CONSTRAINT chat_versions_landing_order_complete,
    DROP COLUMN act_time,
    ADD CONSTRAINT chat_versions_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, position) IN (0, 2));

ALTER TABLE chat_message_versions
    DROP CONSTRAINT chat_message_versions_landing_order_complete,
    DROP COLUMN act_time,
    ADD CONSTRAINT chat_message_versions_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, position) IN (0, 2));

ALTER TABLE item_versions
    DROP CONSTRAINT item_versions_landing_order_complete,
    DROP COLUMN act_time,
    ADD CONSTRAINT item_versions_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, position) IN (0, 2));

ALTER TABLE network_parameter_versions
    DROP CONSTRAINT network_parameter_versions_landing_order_complete,
    DROP COLUMN act_time,
    ADD CONSTRAINT network_parameter_versions_landing_order_complete CHECK (
        num_nonnulls(landed_epoch, position) IN (0, 2));
