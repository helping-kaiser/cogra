# FeedUnread · `spec:design:behavior-feed-unread`

ALWAYS the bell carries a dot GIVEN something has arrived in the notifications list since the reader last opened it

ALWAYS the bell's mark is a dot and never a count

ALWAYS the bell's accessible name reads Notifications — something new GIVEN its dot is lit

ALWAYS the bell's accessible name reads Notifications GIVEN its dot is not lit

WHEN the reader opens the notifications list -> the bell's dot clears

ALWAYS nothing on the feed but the bell changes GIVEN its dot is lit
