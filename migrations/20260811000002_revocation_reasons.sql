-- Revocation carries its reason (auth.md "Reuse detection"): only a
-- rotated token's replay can signal theft — owner- and security-initiated
-- revocations replay benignly from signed-out devices. Rotation links its
-- successor and stores it sealed under the consumed token, so the
-- rotation race loser can recover the same successor inside the grace
-- window while a database read still yields no usable token.
ALTER TABLE auth_refresh_tokens
    ADD COLUMN revoked_reason TEXT,
    ADD COLUMN successor_id   UUID REFERENCES auth_refresh_tokens(id),
    ADD COLUMN successor_enc  BYTEA;

-- Pre-migration revoked rows keep today's semantics: every revoked
-- replay took the theft path, which is the 'rotated' behavior.
UPDATE auth_refresh_tokens
    SET revoked_reason = 'rotated'
    WHERE revoked_at IS NOT NULL;

ALTER TABLE auth_refresh_tokens
    ADD CONSTRAINT auth_refresh_tokens_reason_paired
        CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL)),
    ADD CONSTRAINT auth_refresh_tokens_reason_known
        CHECK (revoked_reason IS NULL
               OR revoked_reason IN ('rotated', 'owner', 'security')),
    ADD CONSTRAINT auth_refresh_tokens_successor_rotated_only
        CHECK (successor_id IS NULL OR revoked_reason = 'rotated'),
    ADD CONSTRAINT auth_refresh_tokens_successor_sealed
        CHECK ((successor_id IS NULL) = (successor_enc IS NULL));
