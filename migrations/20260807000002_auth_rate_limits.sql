-- Auth-endpoint throttle state (auth.md "Rate limiting"): one row per
-- (scope, key). Counted limits use window_start + count as a fixed
-- window; the login backoff uses failures + blocked_until, with
-- window_start doubling as the last-activity mark the GC sweep reads.
-- Postgres rather than a cache tier: auth attempts are low-volume, every
-- attempt already reaches the store, and a single atomic upsert makes
-- concurrent attempts race-proof.

CREATE TABLE auth_rate_limits (
    scope         text        NOT NULL,
    key           text        NOT NULL,
    window_start  timestamptz NOT NULL,
    count         integer     NOT NULL DEFAULT 0,
    failures      integer     NOT NULL DEFAULT 0,
    blocked_until timestamptz,
    PRIMARY KEY (scope, key)
);
