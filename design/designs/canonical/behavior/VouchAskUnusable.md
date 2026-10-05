# VouchAskUnusable · `spec:design:behavior-vouch-ask-unusable`

ALWAYS the page opens before the reader commits to anything GIVEN the ask link can stage nobody right now

ALWAYS the page names nobody but the person asking

ALWAYS the page wears no error colour

ALWAYS the heading reads @noor is already in and the way on is See @noor's profile GIVEN the person has landed

ALWAYS the heading reads @noor is waiting on someone else and the back arrow is the only way out GIVEN the person's one live application waits on another member

ALWAYS no profile door stands GIVEN the person has not landed

WHEN tap See @noor's profile -> the person's profile opens

WHEN tap the back arrow -> the state the link opened over comes back AND NEVER anything is staged

WHEN tap the back arrow GIVEN the link opened the app cold -> the feed's root opens

WHEN the person's live application ends without them getting in -> the same ask link opens the ask again
