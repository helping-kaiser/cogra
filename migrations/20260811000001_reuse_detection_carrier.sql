-- The narrow security-event carrier (auth.md "Reuse detection"):
-- refresh-token reuse stamps the account, and the first successful
-- login after detection reads and clears the stamp to surface the
-- notice exactly once.
ALTER TABLE user_credentials ADD COLUMN reuse_detected_at TIMESTAMPTZ;
