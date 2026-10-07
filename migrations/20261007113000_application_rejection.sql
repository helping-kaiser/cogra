-- The approver's close of an application (auth.md "Rejection"): set
-- instead of approved_at, by rejectApplication or by
-- rejectLinkApplications sweeping a link's waiting queue — never by a
-- link's revocation. The row stays and nothing is deleted; a rejected
-- application stops being approvable and stops holding its single-use
-- invite link's slot (auth.md "Invite-link generation").

ALTER TABLE auth_applications
    ADD COLUMN rejected_at TIMESTAMPTZ;
