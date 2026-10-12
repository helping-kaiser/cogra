-- The account-deletion lifecycle (auth.md "Self-service deletion";
-- erasure.md §5): a request mails a link and schedules nothing;
-- opening the link confirms and fixes the deadline; a second request
-- supersedes the first; an unopened link dies 7 days after its
-- request; cancel ends whatever stands.
--
-- A row is requested until confirmed_at is set, and only then does it
-- carry a deadline — the CHECK makes the two one fact. A row ends once:
-- cancelled, superseded, or executed (or, unconfirmed, by its token
-- expiring). Every end answers the same DELETION_TOKEN_INVALID, so an
-- ended row tells a late link nothing an unknown token would not; the
-- spent-secret sweep drops cancelled, superseded and expired rows after
-- retention. The executed row stays for the erasure engine.

ALTER TABLE auth_account_deletions
    ALTER COLUMN scheduled_for DROP NOT NULL,
    ADD COLUMN confirmed_at     TIMESTAMPTZ,
    -- The unopened link's lifetime; read only while confirmed_at is null —
    -- once opened, the link stays valid through the grace.
    ADD COLUMN token_expires_at TIMESTAMPTZ,
    ADD COLUMN superseded_at    TIMESTAMPTZ;

-- Rows from the foundation shape carried a deadline, so they were
-- confirmed; their link's lifetime is the request's 7 days.
UPDATE auth_account_deletions
   SET confirmed_at = requested_at,
       token_expires_at = requested_at + INTERVAL '7 days';

ALTER TABLE auth_account_deletions
    ALTER COLUMN token_expires_at SET NOT NULL,
    ADD CONSTRAINT auth_account_deletions_deadline_iff_confirmed
        CHECK ((confirmed_at IS NULL) = (scheduled_for IS NULL));

-- Several standing rows per account were possible before; the newest
-- stays, the older ones end as superseded.
UPDATE auth_account_deletions d
   SET superseded_at = NOW()
 WHERE d.cancelled_at IS NULL
   AND d.executed_at IS NULL
   AND EXISTS (SELECT 1 FROM auth_account_deletions n
                WHERE n.user_id = d.user_id
                  AND n.cancelled_at IS NULL
                  AND n.executed_at IS NULL
                  AND (n.requested_at, n.id) > (d.requested_at, d.id));

-- At most one standing request per account.
CREATE UNIQUE INDEX auth_account_deletions_one_standing_idx
    ON auth_account_deletions (user_id)
    WHERE cancelled_at IS NULL AND superseded_at IS NULL AND executed_at IS NULL;

-- The executor's work list: confirmed, neither cancelled nor executed.
DROP INDEX auth_account_deletions_due_idx;
CREATE INDEX auth_account_deletions_due_idx
    ON auth_account_deletions (scheduled_for)
    WHERE confirmed_at IS NOT NULL AND cancelled_at IS NULL AND executed_at IS NULL;
