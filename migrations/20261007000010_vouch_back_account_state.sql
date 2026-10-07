-- The vouch-back's account state, on the landed application row beside
-- reciprocated_at (auth.md "Reciprocation is the joiner's own act").
--
-- first_opinion_at is the latched derived cache of the member's first
-- Opinion, toward any target, confirming in the mirror: the moment the
-- borrowed view ends for good (api-spec.md Query.borrowedView). It
-- latches only on a landed Opinion — an in-flight one ends the borrowing
-- without latching, because an expiry with nothing landed returns it —
-- and is rebuildable by re-scanning the mirror.
--
-- vouch_back_dismissed_at is the member's own act of putting the
-- vouch-back prompt away for good, on every device (User.vouchBackDismissed).
-- Authoritative L2 state, not a cache: nothing on the graph records it.

ALTER TABLE auth_applications
    ADD COLUMN first_opinion_at        TIMESTAMPTZ,
    ADD COLUMN vouch_back_dismissed_at TIMESTAMPTZ;
