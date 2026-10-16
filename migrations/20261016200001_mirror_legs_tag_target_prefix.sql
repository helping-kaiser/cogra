-- The `#prefix` cue's claim fold (api-spec.md "Search", "Cues"; PR-98):
-- every tag leg whose target names a topic starting with the cue,
-- `target LIKE 'name:<prefix>%'`. The leg table's btree indexes on
-- `target` use the database's default collation, and a non-C collation's
-- btree cannot serve a LIKE prefix (PostgreSQL docs §11.10, "Operator
-- Classes and Operator Families": text_pattern_ops). This index can: it
-- compares strictly character by character, so the planner turns the
-- prefix into a range scan. It is partial on the tag legs, the only legs
-- the fold reads.

CREATE INDEX mirror_legs_tag_target_prefix_idx
    ON mirror_record_legs (target text_pattern_ops)
    WHERE leg = 't' AND family = 'tag';
