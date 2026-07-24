-- The applicant's chosen name IS the handle it becomes at landing
-- (auth.md "Handle and email format"; data-model.md `auth_applicants`) —
-- one name for one concept, so the availability checks against
-- actors.handle read as what they are.
ALTER TABLE auth_applicants RENAME COLUMN username TO handle;

-- The applicant token (api-spec.md "Auth and accounts"): the secret that
-- authorizes exactly the applicant's own flow — status polling, signing
-- the staged Registration, claiming the first session. A dedicated
-- hashed secret, because the row id is visible to the inviter's approval
-- queue and must not be a session-minting capability. Hash-at-rest, like
-- every other auth token.
ALTER TABLE auth_applicants ADD COLUMN applicant_token_hash BYTEA UNIQUE;
-- No code has ever written this table (slice 0 removed the pre-rebase
-- auth wholesale), so tightening to NOT NULL is safe — and fails loudly
-- rather than silently if that assumption is ever wrong.
ALTER TABLE auth_applicants ALTER COLUMN applicant_token_hash SET NOT NULL;
