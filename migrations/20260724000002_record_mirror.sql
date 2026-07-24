-- The record mirror (data-model.md "The record mirror"): a rebuildable
-- cache of the accepted L1 records CoGra traverses. May lag, never
-- diverge; keyed by L1's own record identifier stored verbatim — the
-- mirror never re-mints identity. layer1-interface.md §8 owns the record
-- shape; the mirror stores what the interface defines and adds nothing.

CREATE TABLE mirror_records (
    record_id       TEXT    PRIMARY KEY,   -- L1 act identifier, verbatim
    family          TEXT    NOT NULL,
    author          TEXT    NOT NULL,      -- the author's Actor address atom
    epoch           BIGINT  NOT NULL,      -- landing epoch
    act_time        BIGINT  NOT NULL,      -- authoritative causal key: Lamport time
    position        BIGINT  NOT NULL,      -- authoritative causal key: host position
    payload_marked  BOOLEAN NOT NULL,      -- non-empty payload committed
    payload_witness BYTEA   NOT NULL       -- the content commitment
);
CREATE INDEX mirror_records_author_idx ON mirror_records (author);
CREATE INDEX mirror_records_epoch_idx  ON mirror_records (epoch);

-- Hyper-edge legs are child rows keyed (record, leg); a binary act has one
-- 'binary' row. family/epoch/causal key are duplicated from the parent
-- record purely to serve the standing fold and expansion query shapes with
-- single-table indexes — caches of the same record, no independent
-- authority.
CREATE TABLE mirror_record_legs (
    record_id TEXT             NOT NULL REFERENCES mirror_records(record_id),
    leg       TEXT             NOT NULL CHECK (leg IN ('binary', 'a', 't')),
    source    TEXT             NOT NULL,
    target    TEXT             NOT NULL,
    p_d       DOUBLE PRECISION NOT NULL,   -- the leg's rendering of the tuple
    p_i       DOUBLE PRECISION NOT NULL,
    domain    TEXT             NOT NULL,
    mask_a00  BOOLEAN          NOT NULL,   -- stored mask over the bilinear block
    mask_a01  BOOLEAN          NOT NULL,
    mask_a10  BOOLEAN          NOT NULL,
    mask_a11  BOOLEAN          NOT NULL,
    tier      TEXT             NOT NULL CHECK (tier IN ('full', 'half', 'marginal')),
    tau       DOUBLE PRECISION NOT NULL,   -- host-cached projection maturity τ_e
    family    TEXT             NOT NULL,
    epoch     BIGINT           NOT NULL,
    act_time  BIGINT           NOT NULL,
    position  BIGINT           NOT NULL,
    PRIMARY KEY (record_id, leg)
);
CREATE INDEX mirror_legs_source_idx ON mirror_record_legs (source);
CREATE INDEX mirror_legs_target_idx ON mirror_record_legs (target);
CREATE INDEX mirror_legs_fold_idx   ON mirror_record_legs (family, target, epoch);

-- The epoch cursor: the last fully-ingested epoch. Ingestion appends
-- records and advances it in one transaction
-- (architecture.md "Record ingestion"). -1 = nothing ingested.
CREATE TABLE mirror_epoch_cursor (
    singleton  BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    last_epoch BIGINT  NOT NULL
);
INSERT INTO mirror_epoch_cursor (singleton, last_epoch) VALUES (TRUE, -1);
