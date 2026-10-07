-- L1 stand-in state (crates/l1-standin): the admission burn's realization
-- side. Like every l1_* table it plays the substrate behind the seam, is
-- touched only by the l1-standin crate, and is dropped at the swap.
--
-- One row per burn request, keyed by the requester's idempotency key: a
-- retried request with the same key is the same burn, and burns once.
-- B_i rises only when the burn settles, which is due at
-- `settles_after_epoch` (the last closed epoch at request plus the
-- configured settlement delay) — so a delay above zero opens the pending
-- window a real settling realization has.
CREATE TABLE l1_admission_burns (
    key                 UUID        PRIMARY KEY,
    address             TEXT        NOT NULL,
    amount_micro        BIGINT      NOT NULL CHECK (amount_micro > 0),
    requested_epoch     BIGINT      NOT NULL,  -- last closed epoch at request; -1 before any
    settles_after_epoch BIGINT      NOT NULL,
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at          TIMESTAMPTZ            -- B_i credited
);
CREATE INDEX l1_admission_burns_due_idx
    ON l1_admission_burns (settles_after_epoch) WHERE settled_at IS NULL;
