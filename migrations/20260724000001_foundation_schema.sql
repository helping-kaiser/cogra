-- Foundation schema — the L2 side of the single store, translated from
-- docs/implementation/data-model.md (the doc's SQL blocks are the source;
-- comments explaining each design live there). Mirror and stand-in tables
-- ride separate migrations.

-- Content-addressed Type keys (data-model.md "Node identity strategies").
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Actors: one row per actor CoGra serves, any kind. Carries the identity
-- association: row UUID ↔ actor public key + L0 address.
CREATE TABLE actors (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    kind         TEXT        NOT NULL CHECK (kind IN ('user', 'collective', 'system')),
    handle       TEXT        NOT NULL UNIQUE,
    actor_pubkey BYTEA       NOT NULL,
    l0_address   TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User credentials: the login half of a user-kind actor (rows only for
-- kind = 'user'; enforced where sessions are minted).
CREATE TABLE user_credentials (
    actor_id      UUID        PRIMARY KEY REFERENCES actors(id),
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Media attachments: asset metadata only; parents point at attachments.
-- author_id is Postgres-native truth here (Media is not a graph node).
CREATE TABLE media_attachments (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id   UUID         NOT NULL REFERENCES actors(id),
    url         TEXT         NOT NULL,
    mime_type   TEXT         NOT NULL,
    size_bytes  BIGINT,
    alt_text    TEXT,
    options     JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX media_attachments_author_idx
    ON media_attachments (author_id);

-- Actor profiles: append-only display versions, one shape for every kind.
CREATE TABLE actor_profile_versions (
    actor_id         UUID        NOT NULL REFERENCES actors(id),
    display_name     TEXT        NOT NULL,
    bio              TEXT,
    avatar_id        UUID        REFERENCES media_attachments(id),
    cover_id         UUID        REFERENCES media_attachments(id),
    website_url      TEXT,
    redaction_reason TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (actor_id, created_at)
);

-- Content nodes: immutable entity rows + append-only version rows.
CREATE TABLE posts (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id   UUID        NOT NULL REFERENCES actors(id),
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
    author_id   UUID        NOT NULL REFERENCES actors(id),
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
    author_id   UUID        NOT NULL REFERENCES actors(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- content_privacy/epoch: the chat-key epoch of the E2EE story
-- (chats.md §9), unrelated to the L1 epoch machinery.
CREATE TABLE chat_message_versions (
    chat_message_id  UUID        NOT NULL REFERENCES chat_messages(id),
    content          TEXT        NOT NULL,
    content_privacy  TEXT        NOT NULL DEFAULT 'plaintext'
                                 CHECK (content_privacy IN ('plaintext', 'encrypted')),
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

-- Hashtag registry — the L2 naming service for Types (hashtag.md).
-- id is content-addressed: UUIDv5(HASHTAG_NAMESPACE, name); the CHECK is
-- defense-in-depth and the namespace literal must match
-- common::HASHTAG_NAMESPACE.
CREATE TABLE hashtags (
    id         UUID        PRIMARY KEY
                           CHECK (id = uuid_generate_v5(
                               '7c844aef-fe5c-4849-90c2-196cbd8d47c6'::uuid,
                               name)),
    name       TEXT        NOT NULL UNIQUE,  -- stored lowercase, no '#'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Content–attachment junctions (ordered; per-relationship facts live on
-- the junction).
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

-- Personal frontend state (per-viewer, operational, prunable).
CREATE TABLE user_view_log (
    user_id        UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    content_id     UUID        NOT NULL,
    first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, content_id)
);
CREATE INDEX user_view_log_recency_idx
    ON user_view_log (user_id, first_seen_at);

CREATE TABLE user_hidden_actors (
    viewer_id   UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    hidden_id   UUID        NOT NULL REFERENCES actors(id),
    hidden_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (viewer_id, hidden_id)
);

CREATE TABLE chat_read_state (
    user_id      UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    chat_id      UUID        NOT NULL REFERENCES chats(id),
    last_read_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, chat_id)
);

CREATE TABLE user_bookmarks (
    user_id       UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    content_id    UUID        NOT NULL,
    bookmarked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, content_id)
);
CREATE INDEX user_bookmarks_recency_idx
    ON user_bookmarks (user_id, bookmarked_at DESC);

-- User preferences: backend-persisted so they cross devices.
CREATE TABLE user_preferences (
    user_id                          UUID     PRIMARY KEY REFERENCES actors(id) ON DELETE CASCADE,
    content_filtering_severity_level SMALLINT CHECK (
        content_filtering_severity_level IS NULL OR
        (content_filtering_severity_level BETWEEN 0 AND 10)
    )
);

-- Authentication state (auth gates the service, never the graph).
CREATE TABLE auth_refresh_tokens (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    token_hash    BYTEA        NOT NULL UNIQUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_used_at  TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ  NOT NULL,
    device_label  TEXT,
    revoked_at    TIMESTAMPTZ
);
CREATE INDEX auth_refresh_tokens_user_idx
    ON auth_refresh_tokens (user_id, expires_at);

CREATE TABLE auth_invite_links (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id   UUID         NOT NULL REFERENCES actors(id),
    prefill_dim1 REAL         NOT NULL CHECK (prefill_dim1 BETWEEN -1.0 AND 1.0),
    prefill_dim2 REAL         NOT NULL CHECK (prefill_dim2 BETWEEN -1.0 AND 1.0),
    single_use   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ  NOT NULL,
    revoked_at   TIMESTAMPTZ
);
CREATE INDEX auth_invite_links_inviter_idx
    ON auth_invite_links (inviter_id);

CREATE TABLE auth_applicants (
    id                            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_link_id                UUID         NOT NULL REFERENCES auth_invite_links(id),
    username                      TEXT         NOT NULL,
    email                         TEXT         NOT NULL UNIQUE,
    password_hash                 TEXT         NOT NULL,
    email_verification_token_hash BYTEA        NOT NULL UNIQUE,
    email_verified_at             TIMESTAMPTZ,
    actor_pubkey                  BYTEA        NOT NULL,
    l0_address                    TEXT         NOT NULL,
    approved_at                   TIMESTAMPTZ,
    landed_at                     TIMESTAMPTZ,
    created_at                    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at                    TIMESTAMPTZ  NOT NULL
);
CREATE INDEX auth_applicants_link_idx
    ON auth_applicants (invite_link_id, approved_at);

CREATE TABLE auth_key_backups (
    user_id    UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    blob       BYTEA       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, created_at)
);

CREATE TABLE collective_cosign_halves (
    collective_id UUID        NOT NULL REFERENCES actors(id),
    member_id     UUID        NOT NULL REFERENCES actors(id),
    key_half      BYTEA       NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collective_id, member_id)
);

CREATE TABLE auth_password_resets (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    token_hash      BYTEA       NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ
);

CREATE TABLE auth_email_changes (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
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
    user_id             UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
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

-- System-actor key custody: the backend-custodied signing seeds of the
-- system actors (substrate.md §8 — custody by design; seeded at genesis,
-- network.md §2). L2-authoritative operational state.
CREATE TABLE system_actor_keys (
    actor_id     UUID  PRIMARY KEY REFERENCES actors(id),
    signing_seed BYTEA NOT NULL
);

-- Overlay: the network parameter carrier — the operational mirror of the
-- charter's parameter schedule (network.md §4), stored as layered
-- properties per data-model.md "Overlay state and layered properties":
-- append-only version rows, newest row wins, rebuildable by replaying the
-- finalization fold over public records.
CREATE TABLE network_parameter_versions (
    parameter  TEXT        NOT NULL,
    value      JSONB       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (parameter, created_at)
);

-- Application registry.
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

-- Honor ledgers: per-community, append-only, membership-gated in the
-- service layer (governance.md §11).
CREATE TABLE honor_entries (
    community_id UUID        NOT NULL,
    member_id    UUID        NOT NULL,
    amount       NUMERIC     NOT NULL,
    kind         TEXT        NOT NULL,
    ref_id       BYTEA,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX honor_entries_member_idx
    ON honor_entries (community_id, member_id, created_at);
