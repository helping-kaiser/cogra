# FeedDeleting · `spec:design:behavior-feed-deleting`

ALWAYS the deletion band rides every logged-in surface GIVEN the account's confirmed deletion is in its grace period

ALWAYS the deletion band stands in the root's band, collapsing and returning with it, and directly under the page header on an inner surface

ALWAYS the deletion band reads Your account is deleted in 6 days. with Cancel, counting the days left GIVEN the content sweep was not opted into

ALWAYS the deletion band reads Your account and everything you posted are deleted in 6 days. with Cancel, counting the days left GIVEN the content sweep was opted into

ALWAYS the deletion band and the borrowed view's band never stand together

ALWAYS the feed under the deletion band is unchanged, with the reader's own posts in it GIVEN the account's confirmed deletion is in its grace period

ALWAYS nothing is redacted and nothing is withdrawn GIVEN the account's confirmed deletion is in its grace period

WHEN tap Cancel on the deletion band -> the request is abandoned AND the deletion band goes AND the snackbar reads Canceled — your account stays, and nothing was deleted. AND NEVER the snackbar offers Undo AND NEVER a confirmation screen opens

WHEN tap Cancel on the deletion band GIVEN the reader is offline -> the network error answers
