-- Per-viewer notification rows and the seen pointer behind the bell
-- (notifications.md; data-model.md "Personal frontend state").
-- Operational and rebuildable from the record mirror and the application
-- registry, never authoritative, kept without a bound (notifications.md
-- "Retention").

CREATE TABLE user_notifications (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    kind           TEXT        NOT NULL CHECK (kind IN (
                       'comment', 'reply', 'mention', 'citation', 'profile_opinion',
                       'application_approvable', 'invite_landed',
                       'application_approved', 'application_rejected')),
    -- Cascades: an applicant who deletes itself (or is reaped) takes the
    -- rows naming it along; a member is erased in place and keeps its
    -- actors row, so rows naming it stand and read the deleted form.
    actor_id       UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    -- The node the row opens on and the viewer's own node the act
    -- reached: bare L2 ids of any node class, as user_bookmarks holds them.
    subject_id     UUID,
    context_id     UUID,
    -- L1's own identifier for the causing record, verbatim. No FK: the
    -- mirror resets on a rebuild, and the row outlives it.
    record_id      TEXT,
    application_id UUID        REFERENCES auth_applications(id) ON DELETE CASCADE,
    -- One row per (viewer, act): every writer is idempotent on it, which
    -- is what makes a replay or a rebuild write nothing twice.
    dedup_key      TEXT        NOT NULL,
    -- When the act reached the viewer: the ingestion pass that observed
    -- its landing, or the account transition's commit.
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at        TIMESTAMPTZ,
    CHECK (user_id <> actor_id)
);
CREATE UNIQUE INDEX user_notifications_one_per_act_idx
    ON user_notifications (user_id, dedup_key);
-- Newest first, keyset on (created_at, id).
CREATE INDEX user_notifications_recency_idx
    ON user_notifications (user_id, created_at DESC, id DESC);

-- The seen pointer behind the bell: one row per viewer, moving forward
-- only. A row is unseen while its created_at is past seen_at.
CREATE TABLE user_notification_state (
    user_id  UUID        PRIMARY KEY REFERENCES actors(id) ON DELETE CASCADE,
    seen_at  TIMESTAMPTZ NOT NULL
);
