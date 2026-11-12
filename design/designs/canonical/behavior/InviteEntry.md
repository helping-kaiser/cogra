# InviteEntry · `spec:design:behavior-invite-entry`

ALWAYS the header's arrow reads Back and is a link to the bare view, never history

WHEN press the header's back arrow -> FeedBare opens

ALWAYS the field asks for the invite link, and reads a bare invite id pasted in its place as the same link

ALWAYS the word token never reaches the screen

WHEN press Continue -> Continue refuses a second press until the link check answers AND NEVER Continue dims

WHEN the link check has not answered 200ms after the press -> Continue reads Continuing… AND NEVER a spinner appears

WHEN the link checks out -> Join opens holding the link, with the inviter's face and name

WHEN the link is read and refused as unusable -> JoinInvalid opens

WHEN press Continue GIVEN nothing in the field reads as a link -> the field's line reads That doesn't look like an invite link. AND the field takes the error state AND NEVER the heading or the intro changes

WHEN press Continue GIVEN no answer reaches the device -> the field keeps what was pasted AND the line That didn't send. Try again. stands above Continue AND Continue stays, the retry

WHEN tap Already have an account? Sign in -> SignIn opens

WHEN tap Just looking? Browse the feed GIVEN an inviter's link was seen -> the feed opens in that inviter's borrowed view

WHEN tap Just looking? Browse the feed GIVEN no usable link was seen -> FeedBare opens

WHEN no answer has come 5s after the press of Continue -> Continue still reads Continuing… AND NEVER a slow line or a progress indicator appears

ALWAYS the screen's ways out refuse a press, undimmed and unchanged in face, from 200ms after the press of Continue until its answer comes — an entry form keeps its exits held while it submits, the named exception to Close (jakob 2026-11-11)

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach

ALWAYS Continue stands disabled with no line above it and its spoken description reads Waiting for your invite link GIVEN Invite link is empty

WHEN the first character is typed in Invite link -> Continue wakes AND its spoken description Waiting for your invite link goes

WHEN press system Back -> the screen the header's back arrow links to opens, exactly as the arrow's press opens it AND NEVER Back walks the history instead
