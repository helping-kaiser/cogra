# InviteEntryError · `spec:design:behavior-invite-entry-error`

WHEN press Continue GIVEN nothing in the field reads as a link -> the field's line reads That doesn't look like an invite link. AND the field takes the error state AND the field keeps what was typed AND NEVER the heading or the intro changes

ALWAYS the error line names the link and never a code

WHEN typing in the field GIVEN the field carries its error line -> the field re-checks what is typed as it changes AND the line goes once the text reads as a link

ALWAYS the header's arrow reads Back and is a link to the bare view, never history

WHEN press the header's back arrow -> FeedBare opens

WHEN press Continue -> Continue refuses a second press until the link check answers AND NEVER Continue dims

WHEN the link check has not answered 200ms after the press -> Continue reads Continuing… AND NEVER a spinner appears

WHEN the link checks out -> Join opens holding the link, with the inviter's face and name

WHEN the link is read and refused as unusable -> JoinInvalid opens

WHEN press Continue GIVEN the text still reads as no link -> the line stands in place AND NEVER the screen changes

WHEN press Continue GIVEN no answer reaches the device -> the field keeps what was typed AND the fault is said in place on the form

WHEN tap Already have an account? Sign in -> SignIn opens

WHEN tap Just looking? Browse the feed -> FeedBare opens
