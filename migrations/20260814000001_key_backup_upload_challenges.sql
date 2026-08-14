-- Upload proofs need a server-issued challenge (auth.md "Key
-- recovery"): a live session alone could overwrite the blob and
-- silently destroy an account's recovery path, so the upload is signed
-- by the actor key over a challenge the server chose.
--
-- One live challenge per account — issuing replaces, consuming deletes,
-- which is what makes it single-use. The challenge is stored in the
-- clear rather than hashed: unlike a reset token it is not a bearer
-- secret, since holding it authorizes nothing without the actor key.
-- Its properties are freshness and single use, and both survive
-- disclosure.
CREATE TABLE auth_key_backup_challenges (
    user_id    UUID        PRIMARY KEY REFERENCES actors(id) ON DELETE CASCADE,
    challenge  BYTEA       NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
