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

WHEN press Continue GIVEN no answer reaches the device -> the field keeps what was pasted AND the fault is said in place on the form

WHEN tap Already have an account? Sign in -> SignIn opens

WHEN tap Just looking? Browse the feed GIVEN an inviter's link was seen -> the feed opens in that inviter's borrowed view

WHEN tap Just looking? Browse the feed GIVEN no usable link was seen -> FeedBare opens

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach
