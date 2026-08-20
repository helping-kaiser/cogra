-- License qualifiers on the display rows (platform-guidelines.md §5;
-- `def:content:license-qualifiers`). The pair (a, o) is a structural
-- field of the genesis record, immutable and surviving payload removal,
-- so the display row caches the canonical string that record published
-- and the read side never invents one.
--
-- The 2x3 ladder (a ∈ {0,1}, o ∈ {0,0.5,1}) is retired: both axes are
-- degrees on [0,1]. The canonical string keeps its `a=<value>;o=<value>`
-- shape with each value rendered as a trimmed decimal, so every string
-- the ladder ever published is already well-formed under the float
-- grammar and converts to itself — the stored act and staged rows need
-- no rewrite.

ALTER TABLE posts    ADD COLUMN license TEXT;
ALTER TABLE comments ADD COLUMN license TEXT;

-- Backfill from the record the row projects: the staged proposal first
-- (L2-owned, and the only source for a write that has not landed), the
-- stand-in's act row as the fallback for a post whose staged row was
-- already reaped.
UPDATE posts p
   SET license = s.license
  FROM staged_writes s
 WHERE s.target = p.l1_node_id
   AND s.license IS NOT NULL
   AND p.license IS NULL;

UPDATE posts p
   SET license = a.license
  FROM l1_acts a
 WHERE a.target = p.l1_node_id
   AND a.license IS NOT NULL
   AND p.license IS NULL;

UPDATE comments c
   SET license = s.license
  FROM staged_writes s
 WHERE s.target = c.l1_node_id
   AND s.license IS NOT NULL
   AND c.license IS NULL;

UPDATE comments c
   SET license = a.license
  FROM l1_acts a
 WHERE a.target = c.l1_node_id
   AND a.license IS NOT NULL
   AND c.license IS NULL;

-- Rows predating the license field fall back to Public Domain, the
-- unique point of zero severity (`rem:content:public-domain`) and the
-- repo-wide low default.
UPDATE posts    SET license = 'a=0;o=0' WHERE license IS NULL;
UPDATE comments SET license = 'a=0;o=0' WHERE license IS NULL;

ALTER TABLE posts    ALTER COLUMN license SET NOT NULL;
ALTER TABLE comments ALTER COLUMN license SET NOT NULL;
