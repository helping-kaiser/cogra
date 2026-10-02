# FeedUnread · `spec:design:behavior-feed-unread`

ALWAYS the bell carries a dot GIVEN something arrived in the notifications list since the reader last opened it and a root has loaded fresh since it arrived

WHEN a root loads fresh GIVEN something arrived in the notifications list since the reader last opened it -> the bell's dot lights

WHEN something arrives in the notifications list while the reader is on a root -> NEVER the bell's dot lights before that root's next load

WHEN the reader returns to a root by back or by the bar GIVEN something arrived in the notifications list -> NEVER the return lights the bell's dot

ALWAYS the bell's mark is a dot and never a count

ALWAYS the bell's accessible name reads Notifications — something new GIVEN its dot is lit

ALWAYS the bell's accessible name reads Notifications GIVEN its dot is not lit

WHEN the reader opens the notifications list -> the bell's dot clears

ALWAYS nothing on the feed but the bell changes GIVEN its dot is lit
