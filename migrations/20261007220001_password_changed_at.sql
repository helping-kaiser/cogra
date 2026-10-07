-- When the account's password was last set — at registration, a reset
-- or a change (api-spec.md `User.passwordChangedAt`). Settings reads it
-- as the Password row's age. Existing rows set it at registration,
-- which is when their password was last set; every later set stamps it
-- in the same statement that rotates the hash.
ALTER TABLE user_credentials ADD COLUMN password_changed_at TIMESTAMPTZ;

UPDATE user_credentials SET password_changed_at = created_at;

ALTER TABLE user_credentials
    ALTER COLUMN password_changed_at SET NOT NULL,
    ALTER COLUMN password_changed_at SET DEFAULT NOW();
