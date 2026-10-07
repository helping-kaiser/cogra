-- The account's cross-device preferences beyond the content filter
-- (api-spec.md `UserPreferences`): the license the composer starts a
-- new post from, and whether the account has seen the intro.
--
-- The license pair is set or unset together — NULL is "unset", which
-- reads as public domain (0/0) — and each axis takes only the three
-- readings the composer publishes. It seeds the authoring-time
-- declaration and binds nothing: a post's license is settled at its
-- own genesis signing.
ALTER TABLE user_preferences
    ADD COLUMN default_license_attribution DOUBLE PRECISION
        CHECK (default_license_attribution IN (0, 0.5, 1)),
    ADD COLUMN default_license_provenance  DOUBLE PRECISION
        CHECK (default_license_provenance IN (0, 0.5, 1)),
    ADD COLUMN has_seen_onboarding         BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT user_preferences_default_license_pair CHECK (
        (default_license_attribution IS NULL) = (default_license_provenance IS NULL)
    );
