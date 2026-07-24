-- L1 stand-in state (crates/l1-standin). These tables play the substrate's
-- role behind the seam (roadmap.md "The stand-in and the swap"): they are
-- the stand-in's own authoritative store, NOT CoGra state — nothing
-- outside the l1-standin crate touches them, and the whole set is dropped
-- when the real Layer 1 replaces the stand-in.

-- The host identity: one signing key, generated on first use, shared by
-- every process speaking to the same stand-in database.
CREATE TABLE l1_host (
    singleton    BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    signing_seed BYTEA   NOT NULL
);

-- The money surface, honored as numbers (no real Layer 0 economy):
-- balances in integer micro-units (1e-6) so θ-debits stay exact.
CREATE TABLE l1_accounts (
    address            TEXT   PRIMARY KEY,
    pubkey             BYTEA,                     -- learned at first sealed act
    burned_total_micro BIGINT NOT NULL DEFAULT 0, -- B_i (monotone)
    balance_micro      BIGINT NOT NULL DEFAULT 0, -- b_i residual
    action_count       BIGINT NOT NULL DEFAULT 0  -- N_i
);

-- One row per act across the handshake lifecycle:
-- sealed (verified act) → approved (orderable) → accepted (in an epoch).
CREATE TABLE l1_acts (
    act_id             TEXT   PRIMARY KEY,
    author             TEXT   NOT NULL,
    seq                BIGINT NOT NULL,
    family             TEXT   NOT NULL,
    author_pubkey      BYTEA  NOT NULL,
    middle             TEXT,
    target             TEXT   NOT NULL,
    p_d                DOUBLE PRECISION NOT NULL,
    p_i                DOUBLE PRECISION NOT NULL,
    settlement_ref     TEXT,
    license            TEXT,
    asserted_parents   TEXT[] NOT NULL,
    deps               TEXT[] NOT NULL,
    payload            BYTEA  NOT NULL,   -- carriage (centralized phase)
    nonce              BYTEA  NOT NULL,
    pre_signature      BYTEA  NOT NULL,
    content_salt       BYTEA  NOT NULL,
    deps_salt          BYTEA  NOT NULL,
    content_commitment BYTEA  NOT NULL,
    deps_commitment    BYTEA  NOT NULL,
    host_seal          BYTEA  NOT NULL,
    approval_signature BYTEA,
    status             TEXT   NOT NULL CHECK (status IN ('sealed', 'approved', 'accepted')),
    submitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at        TIMESTAMPTZ,
    epoch              BIGINT,
    act_time           BIGINT,
    position           BIGINT,
    -- A monotone author-local sequence makes reuse directly detectable
    -- (`def:graph:act-identifier`).
    UNIQUE (author, seq)
);
CREATE INDEX l1_acts_status_idx ON l1_acts (status, approved_at);
CREATE INDEX l1_acts_epoch_idx  ON l1_acts (epoch, position);

-- Edge projections of accepted acts, with the host-computed maturity.
CREATE TABLE l1_act_legs (
    act_id TEXT NOT NULL REFERENCES l1_acts(act_id),
    leg    TEXT NOT NULL CHECK (leg IN ('binary', 'a', 't')),
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    p_d    DOUBLE PRECISION NOT NULL,
    p_i    DOUBLE PRECISION NOT NULL,
    tau    DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (act_id, leg)
);

-- Closed epochs.
CREATE TABLE l1_epochs (
    epoch     BIGINT PRIMARY KEY,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    act_count BIGINT NOT NULL
);

-- Per-node replay state: the Lamport frontier and the accumulated
-- projected degree (feeds τ_e for later acts).
CREATE TABLE l1_node_state (
    node_id  TEXT   PRIMARY KEY,
    frontier BIGINT NOT NULL,
    degree   BIGINT NOT NULL
);
