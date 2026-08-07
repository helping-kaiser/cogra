# Data Model — PostgreSQL

CoGra runs a single store: this document covers the **PostgreSQL
schema** — the L1 record mirror, the overlay, and CoGra's
authoritative L2 state (display content plus the service tables).
[architecture.md](architecture.md) is the system view;
[graph-db-options.md](graph-db-options.md) records why no graph
database is in the stack.

For the graph model itself (records, families, folds), see
[graph-model.md](../primitive/graph-model.md).

## The Boundary Rule

> What a record **is** lives on L1. What it **shows** lives in
> Postgres. What it **weighs** is recomputed from records, never
> stored.

Within the schema, three kinds of state stay apart
([substrate.md §3](../primitive/substrate.md#3-cogras-stores)):

- **Mirror tables** — L1's truth, cached. May lag, never diverge,
  fully rebuildable from the published ordered sequence.
- **Overlay tables** — CoGra's own machinery (Proposal state, the
  parameter carrier, role marks), itself derived from public
  records and published fold rules.
- **L2 tables** — what CoGra alone is authoritative for: display
  content, identity association, accounts and applications, the key-custody
  stores, honor ledgers, personal frontend state.

UUIDs are the join key across CoGra's tables; mirrored L1 records
keep L1's own record keys (see "ID Strategy").

---

## The record mirror

The mirror caches accepted L1 records for traversal and folds. Its
schema is deliberately thin here: **layer1-interface.md §8 owns the
record shape**; the mirror stores what the interface defines and
adds nothing. Conventions:

- **Keying.** A mirrored record is keyed by **L1's own record
  identifier, stored verbatim** — the mirror never re-mints
  identity. Hyper-edge legs are child rows keyed (record, leg).
- **Columns.** The fields consumed by traversal, folds, and
  display resolution: family, author, target(s), the two authored
  parameters, tier metadata, landing epoch, the authoritative
  causal key (act time, position — what `≺` and newest-wins folds
  read), the host-cached edge-projection maturity `τ_e` (an L1
  by-product; `w̃`'s order-derived ingredient), the payload-marked
  flag, and the payload-witness reference.
- **Indexes serve the standing query shapes:** by **author**
  (forward expansion — the feed's hop-by-hop frontier queries —
  and per-author bundle folds), by **target** (fold inputs,
  display resolution), by **(family, target, epoch)** (membership,
  edit, and ballot folds — newest-wins reads, resolved within an
  epoch by the causal key), and by **epoch** (ingestion,
  incremental recompute).
- **An epoch cursor** records the last fully-ingested epoch;
  ingestion appends records and advances it
  ([architecture.md "Record ingestion"](architecture.md#record-ingestion-the-mirror-contract)).

The contract is the mirror's whole identity: it may lag L1, it
must never diverge, and it can be rebuilt from the published
ordered sequence at any time — mirror state is never precious,
and no backup of it is meaningful.

---

## Overlay state and layered properties

Overlay tables hold CoGra's own machinery — state with no L1 home,
every row derived from public records plus CoGra's published
rules:

- **Proposal state** — per-Proposal lifecycle and the
  epoch-quantized tally, a cache over the ballot records
  ([proposal.md](../instances/proposal.md)).
- **The network parameter carrier** — the operational mirror of
  the charter's parameter schedule, updated when a finalization
  lands ([network.md §4](../primitive/network.md#4-the-overlay-carrier)).
- **Role marks** — `network_role` per account, a cache of the
  Publisher's role Tags and the class labels.

Where an overlay row and the records could disagree, the records
govern; every overlay table is rebuildable by replaying the folds.

**Layered properties** — the append-only history pattern of
[layers.md](../primitive/layers.md), applied where CoGra owns the
store — take the same storage shape as display-content versioning
below: an entity row plus append-only version rows keyed
`(entity_id, created_at)`, newest row wins, history is the rows
themselves. Governed overlay properties (the parameter carrier)
version this way, so the operational cache preserves the same
auditable history the charter schedule carries on L1. The
carrier's concrete shape:

```sql
-- The network parameter carrier (network.md §4): append-only
-- version rows per governed parameter; the newest row is the value
-- in force; the genesis seed (the Charter payload's values) is the
-- fold's base case; each landed finalization appends.
CREATE TABLE network_parameter_versions (
    parameter  TEXT        NOT NULL,
    value      JSONB       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (parameter, created_at)
);
```

---

## Staged writes

The write path stages before it lands
([architecture.md "The write path"](architecture.md#the-write-path)):
a staged act — the canonical proposal, joined by the device's
pre-commitment and the host-sealed verified act as the handshake
advances — is one `staged_writes` row from **prepare** until
**confirm**. Staged payload bytes ride the row; the carriage
tables arrive with the content slice and take over permanent
payload storage then. Promotion on confirm makes the display rows
visible and drives the flows built on landing (an applicant's
Registration confirming flips their account to member —
[auth.md](auth.md)). Staged state is L2-operational: it is exempt
from append-only history and leaves no trace once collected —
nothing existed on the graph.

```sql
CREATE TABLE staged_writes (
    id             UUID        PRIMARY KEY,
    -- The staging actor. An applicant's staged Registration
    -- stages under their own actor row like any other write —
    -- the account exists from registration (auth.md).
    actor_id       UUID        NOT NULL REFERENCES actors(id),

    -- The canonical proposal, stored losslessly: prepare's exact
    -- proposal is what the device signs and the relay submits.
    act_id           TEXT             NOT NULL UNIQUE,
    author           TEXT             NOT NULL,
    seq              BIGINT           NOT NULL,
    family           TEXT             NOT NULL,
    middle           TEXT,
    target           TEXT             NOT NULL,
    p_d              DOUBLE PRECISION NOT NULL,
    p_i              DOUBLE PRECISION NOT NULL,
    settlement_ref   TEXT,
    license          TEXT,
    asserted_parents TEXT[]           NOT NULL DEFAULT '{}',
    deps             TEXT[]           NOT NULL DEFAULT '{}',
    payload          BYTEA            NOT NULL,

    state          TEXT        NOT NULL DEFAULT 'awaiting_pre_sign'
        CHECK (state IN ('awaiting_pre_sign', 'sealing',
                         'awaiting_approval', 'relaying', 'landed',
                         'expired')),

    -- The device's pre-commitment leg, then the host-sealed
    -- verified act, stored as the relay legs return them.
    author_pubkey  BYTEA,
    nonce          BYTEA,
    pre_signature  BYTEA,
    content_salt        BYTEA,
    deps_salt           BYTEA,
    content_commitment  BYTEA,
    deps_commitment     BYTEA,
    host_seal           BYTEA,

    prepared_epoch BIGINT      NOT NULL,
    expired_epoch  BIGINT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Lifecycle rules, driven off the ingestion pass:

- **Promotion matches by act identifier.** Every epoch's ingestion
  marks the staged writes whose records landed. The mirror
  governs: a record landing after its staged write was collected
  still promotes — though its staged payload is already gone.
- **GC is two-phase and epoch-denominated.** A write that has not
  landed within `STAGED_WRITE_GC_EPOCHS` epochs of its
  preparation ([development.md](development.md)) is **expired** —
  payload dropped, state observable, so a device polling a lost
  handshake sees the terminal state rather than a vanished id.
  One further window later the row is deleted. A lost host seal
  (a relay crash between seal and store) expires the write
  immediately: the salts cannot be re-fetched, so no approval can
  ever be produced — the device re-prepares under a fresh
  sequence value.

The author-local act sequence `s_q`
([layer1-interface.md §8.1](../primitive/layer1-interface.md#8-kernel-data-model-authored-acts-projections-and-the-graph))
is allocated at prepare from one counter per L1 author atom —
serving users, applicants, and system actors alike — caught up
against the mirror on every allocation so acts landed outside the
prepare path can never cause identifier reuse:

```sql
CREATE TABLE author_seq_counters (
    author   TEXT   PRIMARY KEY,
    next_seq BIGINT NOT NULL
);
```

---

## PostgreSQL Schema

The sections below are the **L2 side** of the store: display
content and the service tables. Display tables know nothing about
records, weights, or ranking — each answers the question: "given a
UUID, what do I render on screen?"

### Display-content versioning

Display content is append-only
([layers.md](../primitive/layers.md)): edits never overwrite. The
schema encodes this as a split per content kind:

- An **entity table** (`posts`, `comments`, …) holds one immutable
  row per node — the UUID shared with the graph, the immutable
  reference columns (`author_id`, containment caches), and
  `created_at`. This row is what foreign keys reference.
- A **versions table** (`post_versions`, …) holds the mutable
  display fields as append-only rows keyed
  `(entity_id, created_at)`. The **current** value is the newest
  row; the entity's `updated_at` is derived as the newest
  version's `created_at` — no stored column.

A **redaction tombstone** is just another version row: its
`redaction_reason` is non-null, its content fields carry the
visible marker, and the prior values move to the retention
archive ([retention-archive.md](../primitive/retention-archive.md),
[erasure.md](../instances/erasure.md)). The
tombstone's `created_at` is the removed-at instant. Per-field
sensitive flags and the verdict vocabulary are operational
metadata rows; the substrate-visible verdict is the Tag record
([moderation.md](../instances/moderation.md)).

Current-version reads are `ORDER BY created_at DESC LIMIT 1` per
entity (or `DISTINCT ON (entity_id)` for lists), served by the
versions PK.

### Foundation

`media_attachments` is referenced by the actor profiles (avatars)
and several content tables (chat images, post galleries via
junctions, etc.), so it is defined first. The asset row never
points at a parent — see "Why parents point at attachments" below.

```sql
-- Media attachments: asset metadata only (URL, mime, size, alt text,
-- display options, uploader). Parents (posts, comments, chat messages,
-- items, actor profiles, chats) point at attachments via either a
-- junction table (1:N) or a direct FK column (1:1). The asset row
-- never points at a parent — see "Why parents point at attachments"
-- below.
--
-- options carries display hints the frontend reads to lay out the
-- container before the media finishes loading. Validated in the
-- service layer (not by a Postgres CHECK), so the shape can grow
-- without DDL coordination. See "media_attachments.options shape"
-- below for the v1 keys and the versioning convention.
--
-- author_id identifies the uploader (FK to actors — declared
-- after actors below). Unlike posts.author_id (a cache of the
-- record's intrinsic author), this column is Postgres-native
-- source of truth — Media is not a graph node, so there is no
-- rebuild-from-records path. Used by the API to enforce that only
-- the uploader's own parents can reference an asset (anti-hijack),
-- and to find an actor's media when redacting their account (see
-- instances/erasure.md).
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
```

### Actors

One table for every actor kind — users, Collectives, and the
system actors. On L1 they are all the same thing, Actor + Profile;
the L2 differences are bolt-ons (users have a login, Collectives
have custody state, system actors have neither), so the identity
row is shared and the bolt-ons hang off it. One consequence is
deliberate: **handles share one namespace across kinds** — a
mention resolves to exactly one actor.

```sql
-- Actors: one row per actor CoGra serves, any kind. The row
-- carries the identity association — CoGra's row UUID ↔ the
-- actor's public key + L0 address: minted on the device and
-- attached at the logged-in key ceremony for users (auth.md
-- §Application; NULL from registration until the attach — the
-- CHECK keeps the other kinds complete), created at founding for
-- Collectives (collectives.md §2), seeded at genesis for the
-- system actors (network.md §2; system handles are reserved at
-- bootstrap). handle is the mention/lookup name — account state,
-- not display content, so it stays single-current (UNIQUE could
-- not survive version rows). Account-deletion redacts a handle in
-- place to 'redacted-user-{uuid}' per erasure.md — the
-- sanctioned in-place redaction, not an edit path.
CREATE TABLE actors (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    kind         TEXT        NOT NULL CHECK (kind IN ('user', 'collective', 'system')),
    handle       TEXT        NOT NULL UNIQUE,
    actor_pubkey BYTEA,
    l0_address   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (kind = 'user' OR (actor_pubkey IS NOT NULL AND l0_address IS NOT NULL))
);

-- An address binds at most one account (auth.md §Application):
-- the unique indexes are the race-proof enforcement behind
-- attachActorKey's ACTOR_KEY_IN_USE refusal. Key and address are
-- 1:1 (the address derives from the key), so both columns carry
-- the invariant; NULLs (a user before the ceremony) never collide.
CREATE UNIQUE INDEX actors_actor_pubkey_key ON actors (actor_pubkey);
CREATE UNIQUE INDEX actors_l0_address_key ON actors (l0_address);

-- User credentials: the account half of a user-kind actor — rows
-- exist only for kind = 'user', created at registration together
-- with the actor row (auth.md §Application). account_state is the
-- service state gating acting (auth.md §Account states); landing
-- flips it to 'member'. email_verified_at and the token hash
-- carry the registration verification proof; the reaper deletes
-- never-verified accounts whole, and a registration may replace a
-- dead (never-verified, past-bound) account in place (auth.md
-- "Registration collision"). Nothing references this row; it is a
-- pure bolt-on keyed by the actor.
CREATE TABLE user_credentials (
    actor_id                      UUID        PRIMARY KEY REFERENCES actors(id),
    email                         TEXT        NOT NULL UNIQUE,
    password_hash                 TEXT        NOT NULL,
    account_state                 TEXT        NOT NULL CHECK (account_state IN ('guest', 'applicant', 'member')),
    email_verified_at             TIMESTAMPTZ,
    email_verification_token_hash BYTEA       UNIQUE,
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Actor profiles: append-only versions of the profile display
-- fields, one shape for every kind (see "Display-content
-- versioning"). A user edits their own; a Collective's changes
-- land through its governed edit flow (substrate.md §9); system
-- actors get theirs at bootstrap.
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
```

### Content nodes

```sql
-- Posts: one immutable entity row per post; display fields live on
-- post_versions.
CREATE TABLE posts (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id   UUID        NOT NULL REFERENCES actors(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Post versions: append-only display content. One row per edit;
-- the newest row is the rendered post.
CREATE TABLE post_versions (
    post_id          UUID        NOT NULL REFERENCES posts(id),
    title            TEXT,       -- optional headline
    description      TEXT,       -- optional short summary / subtitle
    content          TEXT        NOT NULL,
    redaction_reason TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, created_at)
);

-- Comments: responses to any commentable content node.
-- Comments are full nodes in the graph (can be liked, replied to).
-- target_id + target_type identify the parent — Post, Comment, Chat,
-- ChatMessage, or Item per edges.md §2 Containment. See
-- "target_id + target_type — discriminator, not foreign key" below for
-- why there is no SQL FK on this column.
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

-- Chats: conversation containers.
-- Privacy is per-message (chat_messages.content_privacy), not per-chat —
-- a single chat can carry both plaintext and encrypted messages. See
-- chats.md §7. Profile fields (name, description, image) change
-- through the chat's edit carrier under its governed update
-- authority (substrate.md §9); each applied change appends a
-- version.
CREATE TABLE chats (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_versions (
    chat_id          UUID        NOT NULL REFERENCES chats(id),
    name             TEXT,       -- optional; any chat may set one
    description      TEXT,
    image_id         UUID        REFERENCES media_attachments(id),
    redaction_reason TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (chat_id, created_at)
);

-- Chat messages: individual messages within a chat.
CREATE TABLE chat_messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id     UUID        NOT NULL REFERENCES chats(id),
    author_id   UUID        NOT NULL REFERENCES actors(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat-message versions. content_privacy is per-message and
-- per-version (see chats.md §7): 'plaintext' bodies are readable
-- text; 'encrypted' bodies are ciphertext under the chat's
-- member-derived symmetric key for the epoch the version was
-- authored in. A chat can carry both freely.
--
-- epoch records which key the ciphertext is under (see chats.md §7:
-- chat keys are organized in epochs, advanced on membership change
-- and on passing mid-epoch rotation Proposals). NULL for plaintext
-- rows; NOT NULL for encrypted rows. The frontend uses it to pick
-- the right key. Message bodies never edit (api-spec.md, chats.md
-- §8); version rows arise from redaction only.
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

-- Items: physical or digital goods (future)
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

-- Hashtag registry — the L2 naming service for Types
-- (hashtag.md): name lookup + metadata, including the reserved
-- moderation Types seeded at bootstrap (network.md §2).
-- id is derived via UUIDv5 from the canonical name (see "Node identity
-- strategies" below). No DEFAULT — the API must always supply the
-- deterministic UUID; relying on a random fallback would break content-
-- addressing. The CHECK constraint is defense-in-depth: even a buggy
-- backend cannot write a row whose id doesn't match the derivation.
-- Requires the uuid-ossp extension to be loaded; the namespace UUID
-- literal must match the value committed to source per "Node identity
-- strategies".
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE hashtags (
    id         UUID        PRIMARY KEY
                           CHECK (id = uuid_generate_v5(
                               -- HASHTAG_NAMESPACE_UUID — fixed at the
                               -- project level, committed to source
                               -- (common::HASHTAG_NAMESPACE).
                               '7c844aef-fe5c-4849-90c2-196cbd8d47c6'::uuid,
                               name)),
    name       TEXT        NOT NULL UNIQUE,  -- stored lowercase, no '#'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Content–attachment junctions

Per-parent join tables connecting content nodes to media assets
(see "Why parents point at attachments" below). Junction rows
reference the **entity** row and hold the parent's *current*
gallery: an edit may add and remove junction rows. Gallery
composition is arrangement state, not versioned content — a named
carve-out in [layers.md](../primitive/layers.md); the assets
themselves are never deleted (redaction tombstones them in place),
so no content is lost when an arrangement changes.

```sql
-- Junction: posts → attachments (ordered, optionally a cover).
-- display_order and is_cover are parent-specific facts about the
-- relationship, not properties of the asset.
CREATE TABLE post_attachments (
    post_id       UUID     NOT NULL REFERENCES posts(id),
    attachment_id UUID     NOT NULL REFERENCES media_attachments(id),
    display_order SMALLINT NOT NULL DEFAULT 0,
    is_cover      BOOLEAN  NOT NULL DEFAULT FALSE,
    PRIMARY KEY (post_id, attachment_id)
);

-- Junction: comments → attachments (ordered).
CREATE TABLE comment_attachments (
    comment_id    UUID     NOT NULL REFERENCES comments(id),
    attachment_id UUID     NOT NULL REFERENCES media_attachments(id),
    display_order SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (comment_id, attachment_id)
);

-- Junction: chat messages → attachments (ordered).
CREATE TABLE chat_message_attachments (
    chat_message_id UUID     NOT NULL REFERENCES chat_messages(id),
    attachment_id   UUID     NOT NULL REFERENCES media_attachments(id),
    display_order   SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (chat_message_id, attachment_id)
);

-- Junction: items → attachments (ordered, optionally a cover).
CREATE TABLE item_attachments (
    item_id       UUID     NOT NULL REFERENCES items(id),
    attachment_id UUID     NOT NULL REFERENCES media_attachments(id),
    display_order SMALLINT NOT NULL DEFAULT 0,
    is_cover      BOOLEAN  NOT NULL DEFAULT FALSE,
    PRIMARY KEY (item_id, attachment_id)
);
```

### Personal frontend state

A category of per-viewer tables whose role is to feed the viewing user's
**frontend** (or their delegated miner) — not the graph. They share
three properties:

- **Per-viewer.** Each row belongs to one user.
- **Storage-location-flexible.** This Postgres table is the
  backend-side default for the central frontend. Self-hosted
  clients and on-device caches can keep the same data locally
  and pass it to the calculator as a JSON array; a delegated
  miner holds no copy — the data rides inside each request
  ([miner-api.md "Delegation and trust"](miner-api.md#delegation-and-trust)).
  The shape is the same regardless of where the data came from.
- **Operational, not graph history.** Exempt from the append-only
  rule that governs edges, node properties, and Postgres-side
  display content (see [layers.md](../primitive/layers.md)). These
  tables can be compacted, pruned, or replaced without leaving a
  visible trace.

Instances below: the seen-list (`user_view_log`), the hidden-actors
list (`user_hidden_actors`, frontend-side "don't show me Bob's
content" — see [feed-ranking.md §5.1](../primitive/feed-ranking.md#91-filtering-vs-ranking)),
the chat-read pointer (`chat_read_state`), and bookmarks
(`user_bookmarks`).

```sql
-- View log: per-viewer record of which content nodes have been seen.
-- Used by the feed-ranking computation as an exclusion set
-- (see feed-ranking.md §8).
CREATE TABLE user_view_log (
    user_id        UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    content_id     UUID        NOT NULL,
    first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, content_id)
);
CREATE INDEX user_view_log_recency_idx
    ON user_view_log (user_id, first_seen_at);
```

The seen-list's compaction policy (1-year default, ~7 MB/active-
user-year bound, trade-off, frontend tunability) lives with the
seen-list mechanism in
[feed-ranking.md §8.5](../primitive/feed-ranking.md#94-the-already-seen-filter).

```sql
-- Hidden actors: per-viewer list of actors the viewing user
-- doesn't want in their feed. Applied as a post-rank exclusion
-- filter on the viewing user's side (see feed-ranking.md §5.1; §9
-- for where the filter computes).
CREATE TABLE user_hidden_actors (
    viewer_id   UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    hidden_id   UUID        NOT NULL REFERENCES actors(id),
    hidden_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (viewer_id, hidden_id)
);

-- Chat read state: per-user, per-chat 'last read' pointer.
-- ChatMessages are timestamp-ordered, so a single TIMESTAMPTZ marks
-- where the user has read up to. Unread = messages with created_at
-- > last_read_at. UPSERTed each time the user reads further; the
-- row's most recent update IS last_read_at, so no separate
-- updated_at column is needed.
CREATE TABLE chat_read_state (
    user_id      UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    chat_id      UUID        NOT NULL REFERENCES chats(id),
    last_read_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, chat_id)
);

-- User bookmarks: per-viewer "save this for later" list. Private
-- state, never visible to other actors and never an input to the
-- ranking math (see graph-model.md §3 — bookmarking is a frontend
-- event, not a stance). content_id can be any node UUID; a
-- discriminator is intentionally not stored, mirroring user_view_log.
CREATE TABLE user_bookmarks (
    user_id       UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    content_id    UUID        NOT NULL,
    bookmarked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, content_id)
);
CREATE INDEX user_bookmarks_recency_idx
    ON user_bookmarks (user_id, bookmarked_at DESC);
```

---

### User preferences

Per-user settings stored backend-side so they cross devices.
**Storage location is not flexible** for this category (unlike the
"Personal frontend state" tables above): iOS App Store rules forbid
in-app changes to mature-content settings, so users adjust them in
the web UI and the setting carries over to mobile clients — which
means the central backend has to be the source of truth.

```sql
-- User preferences: per-user frontend settings the backend persists
-- so they cross devices (see section intro for the App Store
-- rationale).
--
-- content_filtering_severity_level: how aggressive the viewing user wants
-- the sensitive-content filter to be. 0 = show everything,
-- 10 = strictest. NULL = unset (frontend default applies).
-- Sensitive-content classification itself is community-moderated;
-- the moderation mechanism lives in instances/moderation.md.
CREATE TABLE user_preferences (
    user_id                          UUID     PRIMARY KEY REFERENCES actors(id) ON DELETE CASCADE,
    content_filtering_severity_level SMALLINT CHECK (
        content_filtering_severity_level IS NULL OR
        (content_filtering_severity_level BETWEEN 0 AND 10)
    )
);
```

---

### Authentication state

Backend-only tables behind CoGra's **service** authentication —
sessions, credentials, application state, the key-custody stores.
Auth gates the service, never the graph: reading the shared graph
requires no row here, and write standing is L1's write rule, not a
session fact ([auth.md](auth.md),
[architecture.md "Write eligibility"](architecture.md#write-eligibility-and-account-states)).

```sql
-- Refresh tokens: one row per active session. The raw token is
-- never persisted — only its SHA-256 hash, so a database read does
-- not yield usable tokens. Rotation, revocation, and reuse-detection
-- semantics live in auth.md §Tokens.
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

-- Invite links: pure service-side staging UX (invitations.md §4).
-- A link never authors anything and nothing here binds: the
-- inviter's approval is the priced act, and the stance values are
-- PRE-FILLED, not pre-committed — the inviter can adjust them at
-- approval. The link URL carries only the row id. Time-gated and,
-- at the inviter's choice, single-use (one applicant slot) or
-- multi-use (many applicants stage through the same link until
-- expiry — the queue scales, the vouching never does). Revocation
-- sets revoked_at.
--
-- inviter_id identifies the inviting actor (FK to actors) — the
-- actual actor whose Opinion the approval commits, never a system
-- actor.
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

-- Applications: one row per application attempt — the invite-link
-- provenance and the approval/landing bookkeeping for an account
-- in the applicant state (auth.md §Application). The account
-- itself (actors + user_credentials) exists from registration;
-- this row carries only what is application-scoped. approved_at
-- marks the inviter's priced approval (which runs funding + the
-- staged Registration inside the approval, and prepares the
-- inviter's Opinion); landed_at is set when the Registration
-- confirms in the mirror and account_state flips to 'member'.
-- The joiner's reciprocation is their own client-signed act after
-- landing, not application state.
--
-- expires_at is bounded by the link's expiry. An expired,
-- never-approved application stops being approvable but deletes
-- nothing — a fresh invite re-arms the account with a new row
-- (applyWithInvite, api-spec.md). At most one live application
-- per account is enforced at applyWithInvite, not by constraint —
-- liveness is time-dependent. Never-verified accounts are deleted
-- whole by the reaper, applications included (auth.md "Expiry").
CREATE TABLE auth_applications (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    invite_link_id  UUID        NOT NULL REFERENCES auth_invite_links(id),
    approved_at     TIMESTAMPTZ,
    landed_at       TIMESTAMPTZ,
    -- Latched derived cache of an L1 fact: set when the record
    -- mirror confirms the joiner's reciprocal Opinion toward the
    -- inviter (auth.md "Reciprocation is the joiner's own act").
    -- The accepted back-edge is permanent (invitations.md §2), so
    -- the latch cannot diverge; rebuildable from the mirror.
    reciprocated_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX auth_applications_link_idx
    ON auth_applications (invite_link_id, approved_at);
CREATE INDEX auth_applications_account_idx
    ON auth_applications (account_id);

-- Key backups: client-encrypted signing-key blobs (auth.md §Key
-- recovery). Ciphertext under the device-generated recovery code —
-- the server cannot decrypt, verify, or reconstruct anything from
-- a row. Opt-in; one current blob per account, replacement
-- appends; recovery on a new device is login + code.
CREATE TABLE auth_key_backups (
    user_id    UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    blob       BYTEA       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, created_at)
);

-- System-actor key custody: the backend-custodied signing seeds of
-- the system actors (substrate.md §8 — custody by design), seeded
-- at genesis (network.md §2). The Genesis Moderator's seed sits
-- here too for the bootstrap's crash-repair path — the operator's
-- own account on the operator's own server; real users' keys are
-- device-held and never appear in this table (auth.md).
CREATE TABLE system_actor_keys (
    actor_id     UUID  PRIMARY KEY REFERENCES actors(id),
    signing_seed BYTEA NOT NULL
);

-- Collective co-signing halves: the backend's half of each
-- act-as-eligible member's 2-of-2 split of the collective key
-- (collectives.md §2). The full key never assembles server-side;
-- the backend co-signs only after checking the member's signed
-- instruction against the governance map. member_id is any actor —
-- a Collective can be a member of a Collective, and custody
-- recurses: the member-side half rides that Collective's own
-- custody arrangement. Deleting the row IS the removal semantics —
-- no membership event forces a re-key.
CREATE TABLE collective_cosign_halves (
    collective_id UUID        NOT NULL REFERENCES actors(id),
    member_id     UUID        NOT NULL REFERENCES actors(id),
    key_half      BYTEA       NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collective_id, member_id)
);

-- Password resets: one row per requested reset. Single-use,
-- short-lived; only the token hash is stored (same rationale as
-- refresh tokens). Completion sets used_at and revokes all the
-- account's refresh tokens per auth.md §Password reset.
CREATE TABLE auth_password_resets (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    token_hash      BYTEA       NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ
);

-- Email changes: the two-sided proof per auth.md §Email change —
-- a code mailed to the original address and a verification link
-- mailed to the new one. The change applies (user_credentials.email
-- updated)
-- only when both sides are confirmed before expires_at.
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

-- Account deletions: the grace-period state per
-- erasure.md §5 — requested, cancellable from any
-- logged-in session until scheduled_for, executed by the worker
-- after it. include_content records the content-level opt-in
-- (settable at request or confirmation).
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
```

---

### Application registry

```sql
-- Versions: one row per release per client component. Lets the API
-- answer "what's the current version of backend/iOS/Android/web?"
-- and "where are the patch notes for version X?". Append-only —
-- each release adds a row; previous rows stay so past patch-note
-- links remain resolvable.
--
-- released_by is an optional list of actor UUIDs the release credits
-- (community contributors beyond what the upstream repo's commit
-- history captures — e.g. designers, translators, testers). The
-- frontend resolves each id against actors. Display-only, never an
-- input to ranking or economics. NULL when nobody beyond the
-- commit history is being credited.
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
```

---

### Honor ledgers

Per-community, append-only, membership-gated
([governance.md §11](../primitive/governance.md#11-honor)).
`community_id` is the issuing community's actor UUID — CoGra
itself is guild #1, and every ledger is keyed by its issuer, so
balances are incomparable across communities by construction.
Reads are membership-gated in the service layer: only a member's
session can query their community's ledger, and no slice or
ranking query path touches these tables — the ranker and miner
slice consume only L1 records, so honor structurally cannot enter
them. The single sanctioned feed read is a community's own named
opt-in feed
([feed-ranking.md §10](../primitive/feed-ranking.md#10-the-default-feed-and-named-feeds)).

```sql
-- Honor entries: never updated, never deleted. Freeze-on-expulsion
-- is enforced by the membership check at read and issuance time,
-- not by touching rows — a frozen ledger is inert, not erased.
-- The issuance vocabulary (kinds, amounts, who may issue) is a
-- governed policy owned by governance.md §11; ref_id points at the
-- authorizing record where one exists.
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
```

---

## What Postgres is never authoritative for

- **The graph.** Records, stances, membership, ownership, roles —
  L1's. The mirror and every overlay table are caches; where they
  could disagree with the records, the records govern.
- **Feed ordering / ranking.** Computed at query time by the
  ranker from viewer-rooted paths over records — no materialized
  scores, no popularity counters. Overlay tally caches exist for
  *display* (a Proposal's live count is a frontend courtesy); the
  binding tally is the epoch-quantized fold over ballot records
  ([proposal.md](../instances/proposal.md)).
- **Money.** Balances, escrow, transfers live on the CGT rail;
  the admission balance is Layer 0's, read as `B_i`. Postgres
  holds pointers and bookkeeping, never amounts that bind.
- **Payload integrity.** The content witness is L1's evidence;
  the carriage tables hold bytes and salts that verify against
  it, and deletion is payload removal — the witness and the
  structural record remain.

---

## Notes

### author_id is a cached derivation — except for media_attachments

The `author_id` columns on `posts`, `comments`, and `chat_messages` are
caches: authorship is intrinsic to the signed L1 record
([authorship.md](../primitive/authorship.md)), so the column is a
projection of the mirror. If Postgres ever disagrees with the
records, rebuild from the records.

`media_attachments.author_id` is the **exception**: Media is not a graph
node, so there is no graph-side authorship derivation to cache. The
column is Postgres-native source of truth. If it gets corrupted, the
recovery path is object-storage ACLs / upload logs — not the graph.

### media_attachments.options shape

JSONB display-layout hints. Every row carries a top-level `v`
integer naming the shape revision; service-layer migrations rev
the value and readers fall back when they see a `v` they do not
understand.

**v1 keys** (all optional unless noted):

| Key            | Type             | Purpose                                                  |
|----------------|------------------|----------------------------------------------------------|
| `v`            | integer (req'd)  | Shape revision. `1` for the current shape.               |
| `aspect_ratio` | string `"W:H"`   | Container ratio so layout reserves space before load.    |
| `duration_ms`  | integer          | Media duration in milliseconds (video/audio).            |

Unknown keys are tolerated — a future v2 may add fields a v1 reader
silently ignores. Removing or renaming a key is a `v` bump.

Validation lives in the service layer that writes the row. A
Postgres-side CHECK was rejected as too rigid for a field expected
to evolve.

**Deferred:** a per-asset cover field (video poster, music cover art)
is a real need but not yet designed. The existing junction-side
`is_cover` selects which attachment leads a multi-asset parent — a
different concern from per-asset cover.

### User-scoped FKs are defense-in-depth, not deletion mechanics

Every user-scoped table (`auth_refresh_tokens`,
`auth_password_resets`, `auth_email_changes`,
`auth_account_deletions`, `auth_key_backups`, `user_view_log`,
`user_hidden_actors`, `chat_read_state`, `user_bookmarks`,
`user_preferences`) carries
`user_id REFERENCES actors(id) ON DELETE CASCADE`. That these
rows exist only for user-kind actors is a service-layer fact
(only a login mints them), not a constraint. Account deletion
does **not** remove the `actors` row or its credentials — PII
is redacted in place per
[erasure.md §2](../instances/erasure.md#2-account-deletion-two-redaction-levels)
— so `ON DELETE CASCADE` does not fire in any normal flow. The FK
exists to prevent orphans from buggy code paths and to give an
operator running an explicit `DELETE` (e.g. emergency cleanup) a
single command that takes the user's private state with them.

Every other actor-reference column (`author_id` everywhere,
`auth_invite_links.inviter_id`, `user_hidden_actors.hidden_id`)
is likewise a real FK to `actors(id)` — see the next note.

### author_id — one foreign key, still a cache

Every `author_id` references `actors(id)`: one identity table for
every actor kind means one FK target, and an actor's kind lives on
its row — adding a kind is a `CHECK` change, never schema churn on
the referencing tables.

The FK constrains the cache to existing actors; it does not make
it truth. For posts/comments/chat_messages the column is a cache
of the record's intrinsic author (the note above); for
media_attachments it is Postgres-native truth.

Reads that need the author join once:

```sql
SELECT p.*, a.handle, a.kind
FROM posts p
JOIN actors a ON a.id = p.author_id;
```

### target_id + target_type — discriminator, not foreign key

`comments.target_id` references either `posts.id`, `comments.id`,
`chats.id`, `chat_messages.id`, or `items.id` — see
[edges.md §2 Containment](../primitive/edges.md). A standard SQL
foreign key can't point to five tables, so the table carries a
`target_type` discriminator with a `CHECK` on the same five values
the graph uses.

The records are the source of truth here too: a comment's parent
is the target of its Review record
([comment.md](../instances/comment.md)). Postgres `target_id` is a
cache of the mirror. Same cache-rebuild rule as `author_id`: if
the cache disagrees with the records, rebuild from the records.

This is also why old `posts(id) ON DELETE CASCADE` and a separate
`parent_comment_id` column are gone: content nodes are never
deleted (per [layers.md §5](../primitive/layers.md#5-deletion-policy)),
and reply chains are causal chains of Review records — Postgres
doesn't need a parallel column.

### Why parents point at attachments

Many parent types attach media: posts (galleries), comments,
chat messages, items, plus 1:1 cases (user avatar, collective
avatar, chat picture). The natural query is always parent →
attachments ("show me the media for this post"), never the
reverse. So:

- `media_attachments` holds **asset metadata only** — no parent
  reference on the asset itself. The asset row is a pure asset,
  reusable across the uploader's own parents.
- 1:N parents reference attachments via per-parent **junction
  tables** (`post_attachments`, `comment_attachments`,
  `chat_message_attachments`, `item_attachments`). One row per
  attachment-on-parent. Per-relationship facts (`display_order`,
  `is_cover`) live on the junction, not on the asset.
- 1:1 parents reference attachments via a direct FK column on
  their version rows (`actor_profile_versions.avatar_id` /
  `.cover_id`, `chat_versions.image_id`).

Junctions cost more rows than an array column would, but each
junction row is FK-enforced, supports per-relationship metadata
without table churn, and makes "find all parents using
attachment X" a normal indexed lookup (relevant for ownership
tracing on account redaction — see
[erasure.md](../instances/erasure.md)).

**Anti-hijack** is enforced at the API layer: when a parent
references an attachment, the API checks
`attachment.author_id == parent.author_id` before writing the
junction row or FK.
Cross-author re-use of media isn't supported through this path —
sharing someone else's content goes via linking to their post,
not by referencing their asset directly.

---

## ID Strategy

1. UUIDs for L2 rows are generated in the **API layer** (Rust),
   not by the database, and are the join key across CoGra's
   tables and payload fields.
2. Mirrored L1 records keep **L1's own record identifiers**,
   stored verbatim — the mirror never re-mints identity (see "The
   record mirror" above). The `actors` table joins the two worlds:
   row UUID ↔ actor public key + L0 address.
3. Postgres uses `UUID` as the primary key type with a `DEFAULT
   gen_random_uuid()` fallback, but the API always supplies it explicitly.
   (Exception: hashtags drop the DEFAULT — see "Node identity strategies"
   below.)

---

## Node identity strategies

Different node types have different *kinds* of identity. The data model
uses three strategies, chosen per type based on what the node
fundamentally *is*.

### Type 1 — Identity is a canonical string

A node whose existence *is* a string concept. Two creations of the same
string should converge on one node, no matter where in the graph (or
which forked instance) they happen.

- **Hashtag**: a hashtag is its name. `#bot-defense` is one concept; the
  Postgres table forbids two rows with the same canonical name.

For these types, the UUID is **content-addressed**: derived
deterministically from the canonical string via
`UUIDv5(HASHTAG_NAMESPACE, canonical_name)` with a fixed project-scoped
namespace UUID. Same name → same UUID *across any instance or fork*. The
UUID is mathematically redundant with the name, but it remains the
database key and the stable handle CoGra's tables and payloads
carry for the Type ([hashtag.md](../instances/hashtag.md) — the L2
naming service).

The canonical-name normalization (currently for hashtags: lowercase, no
`#`) is **load-bearing**: it determines what counts as "the same"
hashtag. Changing the normalization later would invalidate previously-
minted UUIDs. Treat the normalization as part of the schema, not a UI
affordance.

The namespace UUID is fixed at the project level and **never changes**.
Changing it would break every previously-derived hashtag UUID.
Implementation MUST commit the namespace value to source so all
instances and forks compute identical UUIDs.

The Postgres `hashtags` table enforces the derivation at the schema layer
via `CHECK (id = uuid_generate_v5(namespace, name))` — defense-in-depth
against a buggy service layer. Requires the `uuid-ossp` extension and the
same namespace literal as the source-committed value.

Federation across separated instances of these types requires **no
reconciliation** — instances independently compute the same UUIDs from
the same names by construction.

### Type 2 — Identity is a chosen handle (display label)

A node that has a UNIQUE display handle within an instance, but the
handle is a label, not the deep identity. Two separate humans named
"alice" are two different users; they should not collapse to one node
just because they picked the same handle.

- **Actor** (user, Collective, system actor): identified by
  `actors.id` (UUID). `handle` is UNIQUE per instance across all
  kinds — one namespace, so a mention resolves to exactly one
  actor — but the handle is a label, not the identity: two
  separate humans named "alice" are two different actors and
  never collapse.

UUIDs for these types are **random** (`gen_random_uuid()`). The UNIQUE
constraint on the handle prevents within-instance collision.

Federation across separated instances requires explicit reconciliation
for the handle: instance A's `@alice` and instance B's `@alice` could be
the same person or two different people. A federation protocol must
decide. Tracked as a forward question in
[open-questions.md](../open-questions.md) (Q15).

### Type 3 — Identity is per-creation

A node that is a discrete thing brought into existence at a specific
moment. There is no canonical concept the node "represents"; every
creation is its own node.

- **Post, Comment, ChatMessage**: a piece of content authored at a
  specific time. Two posts with identical text by different authors are
  different posts.
- **Chat**: a conversation container. Two chats with the same title are
  different chats.
- **Item**: a goods entry.
- **Overlay rows** (Proposal): a machinery instance brought into
  existence by one creation act.

UUIDs for these types are **random**. There is no UNIQUE constraint on
any user-facing field; identity is the UUID alone.

Federation across separated instances requires reconciliation only for
*cross-references* (e.g. a post in instance A referenced by content in
instance B). Same Q15 as type 2.

### When adding a new node type

Decide which strategy applies first. The choice determines the schema
(UNIQUE constraint? content-addressed UUID? random UUID with no
constraint?) and the cross-instance behavior (free dedup vs.
reconciliation needed). Recording the strategy alongside the new node
type in [nodes.md](../primitive/nodes.md) keeps the conscious choice
visible to future readers.
