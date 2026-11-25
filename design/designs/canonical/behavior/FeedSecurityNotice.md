# FeedSecurityNotice · `spec:design:behavior-feed-security-notice`

WHEN the first sign-in after a reused sign-in was caught lands on its shell -> feed.securityNotice stands at the top of the column, feed.securityNotice.title reading We signed out every device and feed.securityNotice.body reading A sign-in this account had already replaced was used again, which can mean someone else had a copy. If your password might be known to anyone, change it. AND feed.securityNotice.changePassword and feed.securityNotice.dismiss stand under it

ALWAYS feed.securityNotice rides whichever shell the sign-in lands on, an applicant's included

ALWAYS feed.securityNotice wears the olive account-notice register, feed.securityNotice.changePassword filled in the register's inverse and feed.securityNotice.dismiss outlined

ALWAYS the notice is delivered exactly once, and never on a refused sign-in

ALWAYS the card's words never name the token beneath a sign-in

WHEN press feed.securityNotice.changePassword -> the credential screen opens AND nothing about the notice depends on what the reader does there

WHEN press feed.securityNotice.dismiss -> feed.securityNotice goes AND NEVER feed.securityNotice returns

ALWAYS feed.securityNotice stands until feed.securityNotice.dismiss is pressed: after feed.securityNotice.changePassword, after leaving the feed and coming back, and across an app restart

ALWAYS feed.band, the posts and feed.bottomBar beneath the card answer as they do on the feed
