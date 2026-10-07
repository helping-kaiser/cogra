-- The email-change lifecycle (auth.md "Email change"): a 6-digit code
-- with a wrong-try cap, resend and cancel, the unverified carve-out,
-- and one live change per account.
--
-- A change ends once — applied, canceled, or run out — and the ended
-- row stays: a link opened later answers by what ended its change, and
-- an unknown token cannot say that. Run-out carries no stamp of its
-- own; it is `expires_at` passing before any other end (a supersede
-- that stamps `cancelled_at` on an already run-out row still reads as
-- run out). The spent-secret sweep drops ended rows after retention.

ALTER TABLE auth_email_changes
    -- False on the unverified carve-out: the new address's verification
    -- link is the whole proof, and no code exists.
    ADD COLUMN requires_code    BOOLEAN     NOT NULL DEFAULT TRUE,
    -- Wrong codes against the current code; a fresh code resets it.
    ADD COLUMN failed_attempts  INT         NOT NULL DEFAULT 0,
    -- Set when the wrong-try cap disables the code, cleared by a fresh
    -- one.
    ADD COLUMN code_disabled_at TIMESTAMPTZ,
    ADD COLUMN cancelled_at     TIMESTAMPTZ,
    ADD COLUMN applied_at       TIMESTAMPTZ,
    ALTER COLUMN original_code_hash DROP NOT NULL;

-- Rows from before the end stamps existed: a fully proven change whose
-- address the account now holds was applied.
UPDATE auth_email_changes e
   SET applied_at = GREATEST(e.original_confirmed_at, e.new_verified_at)
  FROM user_credentials c
 WHERE c.actor_id = e.user_id
   AND c.email = e.new_email
   AND e.original_confirmed_at IS NOT NULL
   AND e.new_verified_at IS NOT NULL;

-- Several unended rows per account were possible before; the newest
-- stays, the older ones end as superseded.
UPDATE auth_email_changes e
   SET cancelled_at = NOW()
 WHERE e.cancelled_at IS NULL
   AND e.applied_at IS NULL
   AND EXISTS (SELECT 1 FROM auth_email_changes n
                WHERE n.user_id = e.user_id
                  AND n.cancelled_at IS NULL
                  AND n.applied_at IS NULL
                  AND (n.created_at, n.id) > (e.created_at, e.id));

-- One live change per account: a new request ends the old one first.
CREATE UNIQUE INDEX auth_email_changes_one_live_idx
    ON auth_email_changes (user_id)
    WHERE cancelled_at IS NULL AND applied_at IS NULL;
