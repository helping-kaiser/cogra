-- The tenth notification kind (notifications.md "What notifies"): an
-- opinion on the viewer's profile netted back to (0,0) reports as its
-- own row. The ingestion writer mints it from this migration on; an
-- epoch ingested earlier reports it at the next rebuild, like every
-- row the mirror can reconstruct.

ALTER TABLE user_notifications DROP CONSTRAINT user_notifications_kind_check;
ALTER TABLE user_notifications ADD CONSTRAINT user_notifications_kind_check
    CHECK (kind IN (
        'comment', 'reply', 'mention', 'citation', 'profile_opinion',
        'profile_opinion_withdrawn',
        'application_approvable', 'invite_landed',
        'application_approved', 'application_rejected'));
