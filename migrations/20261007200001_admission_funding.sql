-- The admission burn behind the seam (auth.md "Funding"; the entry
-- ceremony's C5): the funding guard, and the held approval leg of an
-- admission Registration whose funding has not settled.

-- The admission funding of one realization address — the idempotent
-- guard. Keyed by ADDRESS, not account: a burn is never removed (R8), and
-- an account deleted and re-registered with the same key must never be
-- funded twice, so the row outlives its account (no cascading FK). Only
-- the inserter of the row requests the burn, under `request_key`, and
-- every re-request reuses that key, so the realization burns once however
-- often the request is retried.
CREATE TABLE auth_admission_fundings (
    address       TEXT        PRIMARY KEY,
    account_id    UUID        REFERENCES actors(id) ON DELETE SET NULL,
    triggered_by  UUID        REFERENCES actors(id) ON DELETE SET NULL,  -- the voucher (funding budget audit)
    amount_micro  BIGINT      NOT NULL CHECK (amount_micro > 0),
    request_key   UUID        NOT NULL UNIQUE,     -- the seam idempotency key
    ticket        TEXT,                            -- the realization's ticket once requested
    requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempts      INT         NOT NULL DEFAULT 0,  -- burn requests sent under the key
    settled_at    TIMESTAMPTZ,
    failed_at     TIMESTAMPTZ
);
CREATE INDEX auth_admission_fundings_pending_idx
    ON auth_admission_fundings (requested_at) WHERE settled_at IS NULL AND failed_at IS NULL;
CREATE INDEX auth_admission_fundings_account_idx
    ON auth_admission_fundings (account_id) WHERE account_id IS NOT NULL;

-- The approval witness of an admission Registration whose funding has not
-- settled: stored with the write in `relaying` and relayed by the
-- settlement pass once the funding settles, then cleared.
ALTER TABLE staged_writes ADD COLUMN held_approval_signature BYTEA;

-- Backfill: every address this instance already funded gets a settled
-- row, so the guard covers it. The funded set is read from L2 facts —
-- the stand-in's own tables are not CoGra's to read (crates/l1-standin
-- tests/table_ownership.rs) — and is exactly the set the old guard
-- funded: actors with no credentials (the genesis cast and system
-- actors), members, and applicants with an approved application (funded
-- at approval). The burned amount is not an L2 fact; the row records the
-- operating default ADMISSION_BURN_MICRO, since the row is the guard and
-- the amount is informational. An address marked funded that never was
-- can only ever be refused a second burn, never handed one.
INSERT INTO auth_admission_fundings (address, account_id, amount_micro, request_key, settled_at)
SELECT a.realization_address, a.id, 100000000, gen_random_uuid(), NOW()
FROM actors a
LEFT JOIN user_credentials c ON c.actor_id = a.id
WHERE a.realization_address IS NOT NULL
  AND (c.actor_id IS NULL
       OR c.account_state = 'member'
       OR EXISTS (SELECT 1 FROM auth_applications ap
                  WHERE ap.account_id = a.id AND ap.approved_at IS NOT NULL))
ON CONFLICT (address) DO NOTHING;
