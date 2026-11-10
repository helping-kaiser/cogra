-- A single-use invite link is used up by the account registered through
-- it, for good (auth.md "Invite-link generation"; data-model.md
-- auth_invite_links). Its slot was read off the application row, which
-- an applicant's own deletion and the reaper both remove, so either gave
-- the slot back. The stamp lives on the link and outlives the account.
ALTER TABLE auth_invite_links ADD COLUMN used_at TIMESTAMPTZ;

-- Every link an application already went through is used, from the
-- first registration through it.
UPDATE auth_invite_links l
   SET used_at = first_use.at
  FROM (SELECT invite_link_id, MIN(created_at) AS at
          FROM auth_applications
         WHERE invite_link_id IS NOT NULL
         GROUP BY invite_link_id) AS first_use
 WHERE first_use.invite_link_id = l.id;
