-- Account deletion's execution redacts the identity association in place
-- (erasure.md §2, data-model.md "User-scoped FKs are defense-in-depth"):
-- the credentials row stays, its address and password hash go. Both go
-- together, so no row is half a login.
ALTER TABLE user_credentials
    ALTER COLUMN email DROP NOT NULL,
    ALTER COLUMN password_hash DROP NOT NULL,
    ADD CONSTRAINT user_credentials_redacted_together
        CHECK ((email IS NULL) = (password_hash IS NULL));
