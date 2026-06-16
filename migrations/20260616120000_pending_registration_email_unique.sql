-- auth_pending_registrations.email must be UNIQUE: the re-registration
-- collision path (auth.md "Re-registration collision") resolves a duplicate
-- submit with `ON CONFLICT (email) DO UPDATE ... WHERE expires_at < NOW()`,
-- which requires a unique constraint to infer the arbiter index. The
-- foundation migration created only a non-unique index; replace it with a
-- UNIQUE constraint (which provides the lookup index too).
--
-- Additive rather than an edit to the foundation migration, which is already
-- applied — editing an applied migration would fail SQLx's checksum check.

ALTER TABLE auth_pending_registrations
    ADD CONSTRAINT auth_pending_registrations_email_key UNIQUE (email);

DROP INDEX auth_pending_registrations_email_idx;
