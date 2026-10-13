-- Device locks (auth.md "Device lock"): the server half of a signed-out
-- device's locked custody. One row per (account, device slot), named by
-- a random id the device holds. The secret is stored as given — it must
-- be released, so it cannot be hashed; a row alone opens nothing without
-- the device's ciphertext. Released behind the current password, never
-- spent by a release, never touched by session revocation. released_at
-- is diagnostic only (the last release) and decides nothing.
CREATE TABLE auth_device_locks (
    id          UUID        PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    secret      BYTEA       NOT NULL CHECK (octet_length(secret) = 32),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ
);
CREATE INDEX auth_device_locks_user_idx ON auth_device_locks (user_id);
