-- Foundation schema — translates docs/implementation/data-model.md.
-- Column-level rationale lives in the doc; comments here are limited to
-- constraints whose values are load-bearing.

-- uuid_generate_v5 backs the hashtags id CHECK below.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

------------------------------------------------------------------------
-- Foundation (data-model.md §Foundation)
------------------------------------------------------------------------

CREATE TABLE media_attachments (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id   UUID         NOT NULL,
    author_type TEXT         NOT NULL CHECK (author_type IN ('user', 'collective')),
    url         TEXT         NOT NULL,
    mime_type   TEXT         NOT NULL,
    size_bytes  BIGINT,
    alt_text    TEXT,
    options     JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX media_attachments_author_idx
    ON media_attachments (author_type, author_id);

------------------------------------------------------------------------
-- Actors (data-model.md §Actors)
------------------------------------------------------------------------

CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT        NOT NULL UNIQUE,
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_profile_versions (
    user_id          UUID        NOT NULL REFERENCES users(id),
    display_name     TEXT        NOT NULL,
    bio              TEXT,
    avatar_id        UUID        REFERENCES media_attachments(id),
    cover_id         UUID        REFERENCES media_attachments(id),
    website_url      TEXT,
    redaction_reason TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, created_at)
);

CREATE TABLE collectives (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE collective_profile_versions (
    collective_id    UUID        NOT NULL REFERENCES collectives(id),
    display_name     TEXT        NOT NULL,
    description      TEXT,
    avatar_id        UUID        REFERENCES media_attachments(id),
    website_url      TEXT,
    redaction_reason TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collective_id, created_at)
);

------------------------------------------------------------------------
-- Content nodes (data-model.md §Content nodes)
------------------------------------------------------------------------

CREATE TABLE posts (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id   UUID        NOT NULL,
    author_type TEXT        NOT NULL CHECK (author_type IN ('user', 'collective')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE post_versions (
    post_id          UUID        NOT NULL REFERENCES posts(id),
    title            TEXT,
    description      TEXT,
    content          TEXT        NOT NULL,
    redaction_reason TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, created_at)
);

CREATE TABLE comments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id   UUID        NOT NULL,
    target_type TEXT        NOT NULL CHECK (target_type IN
                            ('post', 'comment', 'chat', 'chat_message', 'item')),
    author_id   UUID        NOT NULL,
    author_type TEXT        NOT NULL CHECK (author_type IN ('user', 'collective')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE comment_versions (
    comment_id       UUID        NOT NULL REFERENCES comments(id),
    content          TEXT        NOT NULL,
    redaction_reason TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (comment_id, created_at)
);

CREATE TABLE chats (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_versions (
    chat_id          UUID        NOT NULL REFERENCES chats(id),
    name             TEXT,
    description      TEXT,
    image_id         UUID        REFERENCES media_attachments(id),
    redaction_reason TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (chat_id, created_at)
);

CREATE TABLE chat_messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id     UUID        NOT NULL REFERENCES chats(id),
    author_id   UUID        NOT NULL,
    author_type TEXT        NOT NULL CHECK (author_type IN ('user', 'collective')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_message_versions (
    chat_message_id  UUID        NOT NULL REFERENCES chat_messages(id),
    content          TEXT        NOT NULL,
    content_privacy  TEXT        NOT NULL DEFAULT 'plaintext'
                                 CHECK (content_privacy IN ('plaintext', 'encrypted')),
    -- The second arm needs the explicit IS NOT NULL: with epoch NULL the
    -- comparison `epoch >= 1` is NULL, and a NULL CHECK passes — which
    -- would let an encrypted row in without recording its key epoch.
    epoch            INTEGER     CHECK (
                                   (content_privacy = 'plaintext' AND epoch IS NULL) OR
                                   (content_privacy = 'encrypted' AND epoch IS NOT NULL
                                                                  AND epoch >= 1)
                                 ),
    redaction_reason TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (chat_message_id, created_at)
);

CREATE TABLE items (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE item_versions (
    item_id          UUID        NOT NULL REFERENCES items(id),
    name             TEXT        NOT NULL,
    description      TEXT,
    redaction_reason TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (item_id, created_at)
);

-- The namespace literal is HASHTAG_NAMESPACE_UUID — fixed at the project
-- level, never changes (changing it would invalidate every previously
-- minted hashtag UUID). Must stay identical to common::HASHTAG_NAMESPACE;
-- a postgres-store test asserts the two derivations agree.
-- No DEFAULT on id: the API must always supply the UUIDv5 derivation.
CREATE TABLE hashtags (
    id         UUID        PRIMARY KEY
                           CHECK (id = uuid_generate_v5(
                               '7c844aef-fe5c-4849-90c2-196cbd8d47c6'::uuid,
                               name)),
    name       TEXT        NOT NULL UNIQUE,  -- stored lowercase, no '#'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

------------------------------------------------------------------------
-- Content–attachment junctions (data-model.md §Content–attachment junctions)
------------------------------------------------------------------------

CREATE TABLE post_attachments (
    post_id       UUID     NOT NULL REFERENCES posts(id),
    attachment_id UUID     NOT NULL REFERENCES media_attachments(id),
    display_order SMALLINT NOT NULL DEFAULT 0,
    is_cover      BOOLEAN  NOT NULL DEFAULT FALSE,
    PRIMARY KEY (post_id, attachment_id)
);

CREATE TABLE comment_attachments (
    comment_id    UUID     NOT NULL REFERENCES comments(id),
    attachment_id UUID     NOT NULL REFERENCES media_attachments(id),
    display_order SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (comment_id, attachment_id)
);

CREATE TABLE chat_message_attachments (
    chat_message_id UUID     NOT NULL REFERENCES chat_messages(id),
    attachment_id   UUID     NOT NULL REFERENCES media_attachments(id),
    display_order   SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (chat_message_id, attachment_id)
);

CREATE TABLE item_attachments (
    item_id       UUID     NOT NULL REFERENCES items(id),
    attachment_id UUID     NOT NULL REFERENCES media_attachments(id),
    display_order SMALLINT NOT NULL DEFAULT 0,
    is_cover      BOOLEAN  NOT NULL DEFAULT FALSE,
    PRIMARY KEY (item_id, attachment_id)
);

------------------------------------------------------------------------
-- Personal frontend state (data-model.md §Personal frontend state)
------------------------------------------------------------------------

CREATE TABLE user_view_log (
    user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id     UUID        NOT NULL,
    first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, content_id)
);
CREATE INDEX user_view_log_recency_idx
    ON user_view_log (user_id, first_seen_at);

CREATE TABLE user_hidden_actors (
    viewer_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hidden_id   UUID        NOT NULL,
    hidden_type TEXT        NOT NULL CHECK (hidden_type IN ('user', 'collective')),
    hidden_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (viewer_id, hidden_id, hidden_type)
);

CREATE TABLE chat_read_state (
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_id      UUID        NOT NULL REFERENCES chats(id),
    last_read_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, chat_id)
);

CREATE TABLE user_bookmarks (
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id    UUID        NOT NULL,
    bookmarked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, content_id)
);
CREATE INDEX user_bookmarks_recency_idx
    ON user_bookmarks (user_id, bookmarked_at DESC);

------------------------------------------------------------------------
-- User preferences (data-model.md §User preferences)
------------------------------------------------------------------------

CREATE TABLE user_preferences (
    user_id                          UUID     PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    content_filtering_severity_level SMALLINT CHECK (
        content_filtering_severity_level IS NULL OR
        (content_filtering_severity_level BETWEEN 0 AND 10)
    )
);

------------------------------------------------------------------------
-- Authentication state (data-model.md §Authentication state)
------------------------------------------------------------------------

CREATE TABLE auth_refresh_tokens (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash    BYTEA        NOT NULL UNIQUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_used_at  TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ  NOT NULL,
    device_label  TEXT,
    revoked_at    TIMESTAMPTZ
);
CREATE INDEX auth_refresh_tokens_user_idx
    ON auth_refresh_tokens (user_id, expires_at);

CREATE TABLE auth_invitations (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id   UUID         NOT NULL,
    inviter_type TEXT         NOT NULL CHECK (inviter_type IN ('user', 'collective')),
    inviter_dim1 REAL         NOT NULL CHECK (inviter_dim1 BETWEEN -1.0 AND 1.0),
    inviter_dim2 REAL         NOT NULL CHECK (inviter_dim2 BETWEEN -1.0 AND 1.0),
    single_use   BOOLEAN      NOT NULL DEFAULT FALSE,
    consumed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ  NOT NULL,
    revoked_at   TIMESTAMPTZ
);
CREATE INDEX auth_invitations_inviter_idx
    ON auth_invitations (inviter_type, inviter_id);

CREATE TABLE auth_pending_registrations (
    id                            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    username                      TEXT         NOT NULL,
    email                         TEXT         NOT NULL,
    password_hash                 TEXT         NOT NULL,
    invitation_id                 UUID         NOT NULL REFERENCES auth_invitations(id),
    invitee_dim1                  REAL         NOT NULL CHECK (invitee_dim1 BETWEEN -1.0 AND 1.0),
    invitee_dim2                  REAL         NOT NULL CHECK (invitee_dim2 BETWEEN -1.0 AND 1.0),
    email_verification_token_hash BYTEA        NOT NULL UNIQUE,
    created_at                    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at                    TIMESTAMPTZ  NOT NULL
);
CREATE INDEX auth_pending_registrations_email_idx
    ON auth_pending_registrations (email);

CREATE TABLE auth_password_resets (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      BYTEA       NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ
);

CREATE TABLE auth_email_changes (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    new_email             TEXT        NOT NULL,
    original_code_hash    BYTEA       NOT NULL,
    new_email_token_hash  BYTEA       NOT NULL UNIQUE,
    original_confirmed_at TIMESTAMPTZ,
    new_verified_at       TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at            TIMESTAMPTZ NOT NULL
);

CREATE TABLE auth_account_deletions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deletion_token_hash BYTEA       NOT NULL UNIQUE,
    include_content     BOOLEAN     NOT NULL DEFAULT FALSE,
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scheduled_for       TIMESTAMPTZ NOT NULL,
    cancelled_at        TIMESTAMPTZ,
    executed_at         TIMESTAMPTZ
);
CREATE INDEX auth_account_deletions_due_idx
    ON auth_account_deletions (scheduled_for)
    WHERE cancelled_at IS NULL AND executed_at IS NULL;

------------------------------------------------------------------------
-- Application registry (data-model.md §Application registry)
------------------------------------------------------------------------

CREATE TABLE versions (
    component       TEXT        NOT NULL CHECK (component IN
                                ('backend', 'ios', 'android', 'web')),
    version         TEXT        NOT NULL,
    patch_notes_url TEXT,
    released_by     UUID[],
    released_at     TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (component, version)
);
CREATE INDEX versions_current_idx
    ON versions (component, released_at DESC);
