# History · `spec:design:behavior-history`

ALWAYS History is the reader's seen-list, the list slice-3 ranking filters the feed by, and holds nothing else

ALWAYS a content joins History when it was fully in the viewport

ALWAYS History is a feed of every kind the feed serves, Posts, Comments, Profiles and Tags, each as its own feed card

ALWAYS every card in History is the same card the feed draws, fully live, and History draws no card of its own

ALWAYS History stands ordered by the latest time the reader saw each thing, newest-seen first

WHEN the reader sees a thing already in History -> the thing moves to where the latest seeing puts it AND NEVER the thing stands twice

ALWAYS the score on a card in History is that card's own, and the scores never order History

ALWAYS a card in History carries no age of the seeing, only the age the feed card itself carries

ALWAYS every card's row reads the opinion, then the score, then the kind's own act, then the share

ALWAYS a comment's replies appear only in its thread, never in History

ALWAYS a comment card carries no view-replies line

WHEN the comment card's head row is tapped -> the post it answers opens AND its back arrow reads Back to History

WHEN the comment card is tapped outside its head row and its own controls -> the post's comment section opens scrolled to that comment

WHEN the comment glyph on a comment card is tapped -> the post's comment section opens scrolled to that comment AND the reply composer opens aimed at that comment

WHEN a post's media is tapped -> the post opens as it does from the feed AND its back arrow reads Back to History

WHEN the profile card is tapped -> that person's profile opens

WHEN the tag card is tapped -> the tag's page opens

WHEN Tag a new post with it on a tag card is tapped -> the post composer opens at its first stage AND the tag rides staged among the new post's tags

WHEN a press-and-hold on a card's stance face signs -> the face refuses a second press-and-hold until the signing answers AND NEVER the face moves before the signature is taken

WHEN the hold's signing has not answered 200ms after the hold -> the line under the face reads Signing… AND NEVER a spinner appears

WHEN the hold's signing answers within 200ms of the hold -> NEVER the line Signing… appears

WHEN the hold's signing is taken -> the face moves to the new opinion AND the snackbar confirms the signature

WHEN the hold's signing does not go through -> the face stays where it was AND the line under it reads That didn't sign. followed by Retry AND NEVER the snackbar carries the failure

WHEN the hold's signing is refused by the write rule -> the face stays where it was AND the line under it reads You can't sign right now. AND NEVER Retry appears AND NEVER the line takes the failure voice

ALWAYS at most one clip plays in History, by the feed's stage law

ALWAYS a veiled clip has no playback and no sound-disc presence

ALWAYS the search field reads Search your history at rest

WHEN the reader types in the search field -> History narrows to what matches AND the matches stand newest-seen first

ALWAYS the filter trigger reads Everything GIVEN no kind is narrowed

WHEN tap the filter trigger -> the history's filter sheet opens over History

ALWAYS the header, the search field and the filter trigger collapse on the way down and return on the way up

ALWAYS the bottom bar rides with no slot lit

WHEN tap the back arrow -> the reader's own profile comes back, in the state it was left

ALWAYS the back arrow reads Back to your profile
