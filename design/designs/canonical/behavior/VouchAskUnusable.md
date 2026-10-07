# VouchAskUnusable · `spec:design:behavior-vouch-ask-unusable`

ALWAYS the page opens before the reader commits to anything GIVEN the ask link can stage nobody right now

ALWAYS the page opens only for a member or a guest GIVEN the reader is neither the person asking nor an applicant

WHEN the ask link opens GIVEN the reader is an applicant or the person asking -> the reader's own case answers where app-open lands for them, with its snackbar AND NEVER this page opens

WHEN press Set on the ask's pad GIVEN the link turned unusable since the ask opened -> this page opens with the case for the link's new state AND NEVER anything is signed

ALWAYS the page names nobody but the person asking

ALWAYS the page wears no error colour

ALWAYS the heading reads @noor is already in and the way on is See @noor's profile GIVEN the person has landed

ALWAYS the heading reads @noor is waiting on someone else and the back arrow is the only way out GIVEN the person's one live application waits on another member

ALWAYS no vouchAsk.profileDoor stands GIVEN the person has not landed

WHEN tap See @noor's profile -> the person's profile opens

WHEN tap the back arrow -> the state the link opened over comes back AND NEVER anything is staged

WHEN tap the back arrow GIVEN the link opened the app cold -> the feed's root opens

WHEN the person's live application ends without them getting in -> the same ask link opens the ask again
