-- Staged writes (data-model.md "Staged writes"; architecture.md "The write
-- path"): a staged act is one row from prepare until confirm — the
-- canonical proposal, joined by the pre-commitment at pre-sign and the
-- host-sealed verified act as the handshake advances. Staged payload bytes
-- ride the row until the carriage tables arrive with the content slice.
-- Staged state is L2-operational: exempt from append-only history, cleared
-- and reaped when a write never lands.

CREATE TABLE staged_writes (
    id             UUID        PRIMARY KEY,
    -- The staging identity: an actor's session write, or an applicant's
    -- staged Registration before any actor row exists (auth.md "Approval
    -- and landing"). Exactly one is set.
    actor_id       UUID        REFERENCES actors(id),
    applicant_id   UUID        REFERENCES auth_applicants(id),

    -- The canonical proposal (layer1-interface.md §8.4): the structural
    -- body's fields, the payload projection, and the dependency list —
    -- stored losslessly so prepare's exact proposal is what the device
    -- signs and the relay submits.
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

    -- Handshake progress (api-spec.md "The write flow" states, snake_case).
    state          TEXT        NOT NULL DEFAULT 'awaiting_pre_sign'
        CHECK (state IN ('awaiting_pre_sign', 'sealing', 'awaiting_approval',
                         'relaying', 'landed', 'expired')),

    -- The device's pre-commitment leg, set when the pre-signed proposal is
    -- submitted for sealing (`def:graph:proposal-pre-commitment`).
    author_pubkey  BYTEA,
    nonce          BYTEA,
    pre_signature  BYTEA,

    -- The host-sealed verified act, set when the seal returns
    -- (`def:graph:verified-act`).
    content_salt        BYTEA,
    deps_salt           BYTEA,
    content_commitment  BYTEA,
    deps_commitment     BYTEA,
    host_seal           BYTEA,

    -- GC bookkeeping: the mirror cursor at prepare time. A staged write
    -- that never lands is collected after a bounded number of epochs (an
    -- operational parameter — development.md).
    prepared_epoch BIGINT      NOT NULL,
    expired_epoch  BIGINT,

    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (num_nonnulls(actor_id, applicant_id) = 1)
);

CREATE INDEX staged_writes_actor_idx     ON staged_writes (actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX staged_writes_applicant_idx ON staged_writes (applicant_id) WHERE applicant_id IS NOT NULL;
-- The GC sweep scans unlanded rows by preparation epoch.
CREATE INDEX staged_writes_gc_idx        ON staged_writes (prepared_epoch) WHERE state NOT IN ('landed', 'expired');

-- Author-local act sequence counters (layer1-interface.md §8.1,
-- `def:graph:act-identifier`): s_q is actor-chosen, unique, and fixed
-- before submission. One counter per L1 author atom serves users,
-- applicants, and system actors alike; prepare allocates from it
-- transactionally. Initialization and catch-up against the mirror live in
-- the allocation query (postgres-store), not here — the counter is L2
-- bookkeeping, rebuildable like every operational row.
CREATE TABLE author_seq_counters (
    author   TEXT   PRIMARY KEY,
    next_seq BIGINT NOT NULL
);
