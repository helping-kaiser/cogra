-- Key backups keep only the latest blob (auth.md "Key recovery"):
-- recovery serves the newest blob and replaced rows were never
-- readable again, so replacement now overwrites in place. Prune to
-- the newest row per account, then key the table by account.
DELETE FROM auth_key_backups b
 USING auth_key_backups newer
 WHERE newer.user_id = b.user_id
   AND newer.created_at > b.created_at;

ALTER TABLE auth_key_backups
    DROP CONSTRAINT auth_key_backups_pkey,
    ADD PRIMARY KEY (user_id);
