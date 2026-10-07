-- The entry ceremony's landing (auth.md "Approval and landing"; EC-R2,
-- EC-R3): one vouch decision per row, keyed to the recorded act id of the
-- voucher-signed Opinion it prepared. An account lands when its own
-- admission Registration and the first of these Opinions — by the
-- mirror's causal key — have both confirmed, through whichever path that
-- Opinion was decided on.
--
-- History is kept: a vouch whose Opinion was collected unlanded lapses
-- (lapsed_at), and its path waits again; a lapsed vouch that lands late
-- still counts, because the staged-write GC is not final.
CREATE TABLE auth_application_vouches (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID        NOT NULL REFERENCES auth_applications(id) ON DELETE CASCADE,
    voucher_id      UUID        NOT NULL REFERENCES actors(id),
    act_id          TEXT        NOT NULL UNIQUE,   -- the prepared Opinion's L1 act id
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lapsed_at       TIMESTAMPTZ,                   -- staged Opinion collected unlanded
    landed_at       TIMESTAMPTZ                    -- the Opinion confirmed in the mirror
);
-- At most one live vouch per path: a path's approved_at is "this path has
-- a live vouch since", and a second decision on it is refused.
CREATE UNIQUE INDEX auth_application_vouches_live_idx
    ON auth_application_vouches (application_id) WHERE lapsed_at IS NULL AND landed_at IS NULL;
CREATE INDEX auth_application_vouches_application_idx
    ON auth_application_vouches (application_id);

-- Backfill: every approved or landed application gets the vouch row its
-- approval prepared — the issuer's staged Opinion toward the applicant's
-- Profile that depends on the applicant's staged admission Registration.
INSERT INTO auth_application_vouches (application_id, voucher_id, act_id, created_at, landed_at)
SELECT DISTINCT ON (ap.id)
       ap.id, l.inviter_id, s.act_id, s.created_at,
       CASE WHEN EXISTS (SELECT 1 FROM mirror_records m WHERE m.record_id = s.act_id)
            THEN NOW() END
FROM auth_applications ap
JOIN auth_invite_links l ON l.id = ap.invite_link_id
JOIN actors a ON a.id = ap.account_id
JOIN staged_writes s ON s.actor_id = l.inviter_id
                    AND s.family = 'opinion'
                    AND s.target = 'prof:' || a.realization_address
WHERE ap.approved_at IS NOT NULL
  AND EXISTS (SELECT 1 FROM staged_writes r
              WHERE r.actor_id = ap.account_id
                AND r.family = 'registration'
                AND cardinality(r.asserted_parents) = 0
                AND r.act_id = ANY(s.deps))
ORDER BY ap.id, s.created_at
ON CONFLICT (act_id) DO NOTHING;

-- An approved path whose Opinion cannot be found has no live vouch: it
-- waits again. A landed path keeps its landing whatever was found.
UPDATE auth_applications ap
SET approved_at = NULL
WHERE ap.approved_at IS NOT NULL
  AND ap.landed_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM auth_application_vouches v
                  WHERE v.application_id = ap.id AND v.lapsed_at IS NULL);

-- Exactly one landed path per account: the path the ceremony completed
-- through.
CREATE UNIQUE INDEX auth_applications_one_landed_idx
    ON auth_applications (account_id) WHERE landed_at IS NOT NULL;
