-- The Saved list's finalized shape (data-model.md "Personal frontend
-- state"; api-spec.md `User.bookmarks`, `setBookmark`). A bookmark's
-- kind is read from the registries at write time, so a page hydrates
-- one batched read per kind and the saveable set (posts, comments,
-- people) is a table rule; the keyset pages on
-- (bookmarked_at, content_id), so the recency index carries the
-- tie-breaker an Undo's restored time can need.

ALTER TABLE user_bookmarks
    ADD COLUMN kind TEXT CHECK (kind IN ('post', 'comment', 'user'));

-- Backfill through the registries. No writer existed before this
-- migration, so production holds no rows; a dev row that names nothing
-- saveable can never render and is deleted.
UPDATE user_bookmarks b
   SET kind = CASE
       WHEN EXISTS (SELECT 1 FROM posts p WHERE p.id = b.content_id) THEN 'post'
       WHEN EXISTS (SELECT 1 FROM comments c WHERE c.id = b.content_id) THEN 'comment'
       WHEN EXISTS (SELECT 1 FROM actors a
                     WHERE a.id = b.content_id AND a.kind = 'user') THEN 'user'
   END;
DELETE FROM user_bookmarks WHERE kind IS NULL;

ALTER TABLE user_bookmarks ALTER COLUMN kind SET NOT NULL;

DROP INDEX user_bookmarks_recency_idx;
CREATE INDEX user_bookmarks_recency_idx
    ON user_bookmarks (user_id, bookmarked_at DESC, content_id DESC);
