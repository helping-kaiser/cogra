-- The ask link and the approver of every application (auth.md "The ask
-- link"; EC-R3): one ask link per account, written at registration, and
-- an application row per path, each in exactly one member's queue. A
-- row staged through an invite link waits on the link's issuer; a row a
-- member took up from the account's ask link waits on that member.

CREATE TABLE auth_ask_links (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  UUID         NOT NULL UNIQUE REFERENCES actors(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Backfill: every account that ever applied gets its ask link. Genesis
-- accounts never applied and get none.
INSERT INTO auth_ask_links (account_id)
SELECT DISTINCT account_id FROM auth_applications;

ALTER TABLE auth_applications
    ADD COLUMN approver_id UUID REFERENCES actors(id),
    ADD COLUMN ask_link_id UUID REFERENCES auth_ask_links(id) ON DELETE CASCADE;

-- Backfill: every existing row came through an invite link, so it waits
-- on that link's issuer.
UPDATE auth_applications ap
SET approver_id = l.inviter_id
FROM auth_invite_links l
WHERE l.id = ap.invite_link_id;

ALTER TABLE auth_applications
    ALTER COLUMN approver_id SET NOT NULL,
    ALTER COLUMN invite_link_id DROP NOT NULL,
    ADD CONSTRAINT auth_applications_one_provenance
        CHECK ((invite_link_id IS NULL) <> (ask_link_id IS NULL));

-- The approval queue's read: one approver's rows.
CREATE INDEX auth_applications_approver_idx
    ON auth_applications (approver_id, approved_at);

-- At most one open application per account and approver — waiting, or
-- approved with its vouch in flight. Several approvers may each hold
-- one at once (EC-R3); a second stage by the same member is the
-- WAITING_ON_VIEWER refusal this index backs. Approved rows stay inside
-- it because a lapsed vouch returns its path to waiting (approved_at
-- cleared): were they outside, a member could stage a second row beside
-- their own vouch in flight, and the lapse would then collide.
CREATE UNIQUE INDEX auth_applications_one_open_per_approver_idx
    ON auth_applications (account_id, approver_id)
    WHERE rejected_at IS NULL AND landed_at IS NULL;
