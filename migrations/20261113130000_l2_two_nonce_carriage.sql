-- CoGra as the carrier of the content pair (data-model.md "Act payload
-- carriage"; layer1-interface.md §8.2 "Proposal pre-commitment" and
-- "Verified act", §8.4 "Payload state").
--
-- The device signs a pre-commitment over two independent nonces: the
-- content nonce, which forms the content pre-digest beside the payload,
-- and the dependency nonce, disclosed to the host with the dependency
-- list. The host receives the content pre-digest and never the pair
-- (payload, content nonce); the API holds the pair, runs the carriage
-- checks on it before anything reaches the host, and keeps it beside the
-- witness. The content commitment is formed over the content pre-digest,
-- so a carriage row opens its witness only with the content nonce it
-- holds: the pair and its salt are kept, and removed, together.
--
-- Fresh start: payloads carried under the one-nonce handshake open no
-- witness under this formula, and the dev world is reset at the deploy
-- that carries this migration. A database whose carriage tables still
-- hold rows is refused before anything changes.
DO $$
DECLARE
    holding TEXT;
BEGIN
    SELECT string_agg(t, ', ' ORDER BY t) INTO holding FROM (
        SELECT 'staged_writes' AS t WHERE EXISTS (SELECT 1 FROM staged_writes)
        UNION ALL SELECT 'act_payloads' WHERE EXISTS (SELECT 1 FROM act_payloads)
        UNION ALL SELECT 'retention_archive'
            WHERE EXISTS (SELECT 1 FROM retention_archive WHERE original_type = 'act_payload')
    ) AS held;
    IF holding IS NOT NULL THEN
        RAISE EXCEPTION 'the carriage tables still hold payloads carried under the one-nonce handshake (%)', holding
            USING HINT = 'This migration ships with a fresh start of the dev world: reset the database (make reset-db) and migrate from zero.';
    END IF;
END
$$;

-- The staged write holds both nonces from the pre-signature on. The
-- content nonce is content-capable — with the public pre-commitment it
-- confirms a guessed payload — so the reap takes it with the payload and
-- the content salt. The dependency nonce was disclosed to the host with
-- the dependency list and opens no content, so it stays with the rest of
-- the pre-commitment leg.
ALTER TABLE staged_writes DROP CONSTRAINT staged_writes_reaped_conceals;
ALTER TABLE staged_writes RENAME COLUMN nonce TO content_nonce;
ALTER TABLE staged_writes
    ADD COLUMN dependency_nonce BYTEA,
    ADD CONSTRAINT staged_writes_reaped_conceals
        CHECK (payload IS NOT NULL OR (content_nonce IS NULL AND content_salt IS NULL)),
    ADD CONSTRAINT staged_writes_pre_signed_leg_whole
        CHECK ((author_pubkey IS NULL) = (dependency_nonce IS NULL)
               AND (author_pubkey IS NULL) = (pre_signature IS NULL)
               AND (payload IS NULL OR (author_pubkey IS NULL) = (content_nonce IS NULL)));

COMMENT ON COLUMN staged_writes.content_nonce IS
    'The device''s content nonce: forms the content pre-digest with the payload; never sent to the host; reaped with the payload.';
COMMENT ON COLUMN staged_writes.dependency_nonce IS
    'The device''s dependency nonce: forms the dependency pre-digest with the dependency list; disclosed to the host at submission.';

-- A full carriage row is the whole content pair and the host-drawn salt:
-- payload, content nonce and content salt, present together or absent
-- together. The salt and the content pre-digest the nonce reproduces open
-- the witness; the reduction removes all three in one statement. A
-- full-empty payload has no carriage row, so a full row never holds the
-- zero-length string — and the row's existence is the record's payload
-- mark.
ALTER TABLE act_payloads DROP CONSTRAINT act_payloads_salt_goes_with_payload;
ALTER TABLE act_payloads
    ADD COLUMN content_nonce BYTEA,
    ADD CONSTRAINT act_payloads_pair_goes_together
        CHECK ((payload IS NULL) = (content_salt IS NULL)
               AND (payload IS NULL) = (content_nonce IS NULL)),
    ADD CONSTRAINT act_payloads_full_is_not_empty
        CHECK (payload IS NULL OR length(payload) > 0);

COMMENT ON COLUMN act_payloads.content_nonce IS
    'The content nonce of the pair: reproduces the content pre-digest the witness is formed over; NULL with the payload once reduced.';

-- Content-nonce non-reuse, a carriage obligation (layer1-interface.md
-- §8.2 "Entropy custody"): the API refuses a content nonce its author
-- already used for another act. The row holds the nonce's one-way digest
-- over the author's address, never the nonce, so it outlives the
-- reduction that removes the nonce itself and confirms no payload. A
-- digest names the act it was first used for: the same act resubmitting
-- the same nonce is a retry, not a reuse.
CREATE TABLE content_nonce_digests (
    digest     BYTEA       PRIMARY KEY CHECK (length(digest) = 32),
    act_id     TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The genesis bootstrap is the custodian of its cast's keys and of the
-- nonces they pre-sign with. Both nonces are written before the seal is
-- requested, so a bootstrap interrupted after the seal recovers its
-- approval from the custodied key and these nonces; the host keeps
-- neither the payload nor the content nonce. Once a non-empty payload's
-- carriage row holds its content nonce, the nonce leaves this table — one
-- home at a time, removed with the payload by the reduction. An empty
-- payload has no carriage row, and its content nonce, which conceals
-- nothing, stays here.
CREATE TABLE genesis_handshake_nonces (
    act_id           TEXT        PRIMARY KEY,
    content_nonce    BYTEA,
    dependency_nonce BYTEA       NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
