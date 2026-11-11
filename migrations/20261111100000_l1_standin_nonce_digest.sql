-- The proposal nonce's retained digest. Owned by the l1-standin crate and
-- dropped at the swap with the rest of the l1_* set.
--
-- The host validates the nonce's non-reuse across the author's acts at
-- append (layer1-interface.md §8.2, "Proposal pre-commitment") and removes
-- the nonce itself at acceptance, so the check compares a digest the act's
-- row keeps for good: SHA-256 over the tag, the author address and the
-- nonce, each length-framed (common::l1::crypto::nonce_digest). It is
-- one-way, and the pre-digests need the nonce itself, so the kept digest
-- confirms no payload.
--
-- l1_nonce_digest is the same formula in SQL, for the backfill here and for
-- the test that holds the two equal.
--
-- History: an act accepted before this migration has no nonce left, so no
-- digest can be formed for it and its nonce_digest stays NULL; a reuse of
-- such a nonce cannot be detected. An act still in custody (sealed, or
-- approved and deferred) holds its nonce and gets its digest here.

CREATE FUNCTION l1_nonce_digest(author TEXT, nonce BYTEA) RETURNS BYTEA
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
    SELECT sha256(int8send(octet_length(tag)::BIGINT) || tag
               || int8send(octet_length(address)::BIGINT) || address
               || int8send(octet_length(nonce)::BIGINT) || nonce)
      FROM (SELECT convert_to('cogra-l1:nonce-digest:v1', 'UTF8') AS tag,
                   convert_to(author, 'UTF8') AS address) AS framed
$$;

ALTER TABLE l1_acts ADD COLUMN nonce_digest BYTEA;

UPDATE l1_acts SET nonce_digest = l1_nonce_digest(author, nonce) WHERE nonce IS NOT NULL;

ALTER TABLE l1_acts
    ADD CONSTRAINT l1_acts_nonce_digest_length CHECK (octet_length(nonce_digest) = 32),
    ADD CONSTRAINT l1_acts_held_nonce_is_digested CHECK (nonce IS NULL OR nonce_digest IS NOT NULL);

-- NULLs are distinct, so the history's undigested rows never collide.
CREATE UNIQUE INDEX l1_acts_nonce_once_per_author ON l1_acts (author, nonce_digest);
