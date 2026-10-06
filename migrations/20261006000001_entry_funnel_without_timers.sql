-- The entry funnel's rows carry no clock and no stance (auth.md
-- "Expiry", "Invite-link generation").
--
-- An application waits on a vouch with no timer: once its account is
-- verified it stays approvable until it is approved or rejected, and an
-- invite link's expiry bounds only registration through the link. The
-- never-verified bound lives on the account (user_credentials.created_at
-- and the reaper), never on the application row.
--
-- An invite link carries no stance values: the inviter picks them at
-- approval, the priced act. And a link admits one applicant unless the
-- inviter opens it to multi-use.

ALTER TABLE auth_applications DROP COLUMN expires_at;

ALTER TABLE auth_invite_links
    DROP COLUMN prefill_p_d,
    DROP COLUMN prefill_p_i,
    ALTER COLUMN single_use SET DEFAULT TRUE;
