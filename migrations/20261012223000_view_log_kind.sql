-- The seen-list's finalized shape (data-model.md "Personal frontend
-- state"; api-spec.md `User.viewHistory`, `markSeen`). History's `kinds`
-- filter routes through an indexed `kind` column, and its keyset pages
-- on (first_seen_at, content_id), so the recency index carries the
-- tie-breaker.

ALTER TABLE user_view_log
    ADD COLUMN kind TEXT CHECK (kind IN ('post', 'comment', 'user', 'hashtag'));

-- Backfill through the registries. No writer existed before this
-- migration, so production holds no rows; a dev row that names nothing
-- seeable can never render and is deleted.
UPDATE user_view_log l
   SET kind = CASE
       WHEN EXISTS (SELECT 1 FROM posts p WHERE p.id = l.content_id) THEN 'post'
       WHEN EXISTS (SELECT 1 FROM comments c WHERE c.id = l.content_id) THEN 'comment'
       WHEN EXISTS (SELECT 1 FROM actors a
                     WHERE a.id = l.content_id AND a.kind = 'user') THEN 'user'
       WHEN EXISTS (SELECT 1 FROM hashtags t WHERE t.id = l.content_id) THEN 'hashtag'
   END;
DELETE FROM user_view_log WHERE kind IS NULL;

ALTER TABLE user_view_log ALTER COLUMN kind SET NOT NULL;

DROP INDEX user_view_log_recency_idx;
CREATE INDEX user_view_log_recency_idx
    ON user_view_log (user_id, first_seen_at DESC, content_id DESC);
CREATE INDEX user_view_log_kind_recency_idx
    ON user_view_log (user_id, kind, first_seen_at DESC, content_id DESC);
