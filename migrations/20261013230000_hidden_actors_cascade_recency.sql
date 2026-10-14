-- The hidden-actors list's finalized shape (data-model.md "Personal frontend
-- state"; api-spec.md `User.hiddenActors`, `hideActor`).
--
-- The hidden side cascades: the reaper and deleteApplicantAccount delete
-- actors rows, and a hide of an account that no longer exists must not wedge
-- them. A member's erasure redacts in place and keeps the row, so hides of a
-- deleted member stand.
ALTER TABLE user_hidden_actors
    DROP CONSTRAINT user_hidden_actors_hidden_id_fkey,
    ADD CONSTRAINT user_hidden_actors_hidden_id_fkey
        FOREIGN KEY (hidden_id) REFERENCES actors(id) ON DELETE CASCADE;

-- Most recently hidden first, keyset on (hidden_at, hidden_id).
CREATE INDEX user_hidden_actors_recency_idx
    ON user_hidden_actors (viewer_id, hidden_at DESC, hidden_id DESC);
