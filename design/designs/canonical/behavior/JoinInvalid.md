# JoinInvalid · `spec:design:behavior-join-invalid`

WHEN a link pasted at the invite door is read and refused as unusable -> JoinInvalid opens with This invite can't be used anymore AND the field and its ways out stand as the door's

WHEN press Sign in or join, the band's or a guest gate's, GIVEN the invite link held no longer works -> JoinInvalid opens

WHEN tap New here? Enter your invite on the sign-in screen GIVEN the invite link held no longer works -> JoinInvalid opens

WHEN a dead invite link is opened from outside the app -> the landing stands unchanged AND the snackbar reads This invite link has expired. once AND NEVER JoinInvalid opens

WHEN a dead invite link is opened GIVEN the reader is signed in -> the reader stays where they were AND the snackbar reads This invite link has expired. AND NEVER anything else moves

ALWAYS the paragraph promises nothing about an account made earlier

ALWAYS the header's arrow reads Back and is a link to the bare view, never history

WHEN press the header's back arrow -> FeedBare opens

WHEN press Continue -> Continue refuses a second press until the link check answers AND NEVER Continue dims

WHEN the link check has not answered 200ms after the press -> Continue reads Continuing… AND NEVER a spinner appears

WHEN a different link pasted here checks out -> Join opens holding that link, with its inviter's face and name

WHEN the link pasted here is still unusable -> JoinInvalid stands AND NEVER the screen moves

WHEN press Continue GIVEN no answer reaches the device -> the field keeps what was pasted AND the line That didn't send. Try again. stands above Continue AND Continue stays, the retry

WHEN tap Already have an account? Sign in -> SignIn opens

WHEN tap Just looking? Browse the feed -> FeedBare opens

WHEN no answer has come 5s after the press of Continue -> Continue still reads Continuing… AND NEVER a slow line or a progress indicator appears

ALWAYS the screen's ways out stay live while Continue waits on its answer

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach
