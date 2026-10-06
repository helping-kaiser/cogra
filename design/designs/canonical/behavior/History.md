# History · `spec:design:behavior-history`

ALWAYS History is the reader's seen-list, the list slice-3 ranking filters the feed by, and holds nothing else

ALWAYS a content joins History the first time it was fully in the viewport

WHEN the reader sees a thing already in History -> NEVER the seeing is counted AND NEVER the thing moves AND NEVER the thing stands twice

ALWAYS a seeing stays in the app and never becomes a graph record

ALWAYS History is a feed of every kind the feed serves, Posts, Comments, Profiles and Tags, each as its own feed card

ALWAYS every card in History is the same card the feed draws, fully live, and History draws no card of its own

ALWAYS History stands ordered by the time the reader first saw each thing, newest first

ALWAYS a quiet day divider stands above the first thing first seen on each day, reading Today, Yesterday, or the date as 2 October with the year only when it is not the current one

ALWAYS a day divider is part of the list and never part of a card

ALWAYS the score on a card in History is that card's own, and the scores never order History

ALWAYS a card in History carries no age of the seeing, only the age the feed card itself carries

ALWAYS every card's row reads the opinion, then the score, then the kind's own act, then the share

ALWAYS a reply is a comment targeting a comment: as standalone content a reply card may appear in any feed, History included, and the under-card reply expansion never appears in a feed

ALWAYS a history.commentCard carries no view-replies line

ALWAYS a thing removed after it was seen keeps its place in History and wears its removal mark

ALWAYS a hidden account's things stay out of History while the account is hidden

ALWAYS sensitive content in History keeps its veil, as on the feed

ALWAYS History offers no way to clear the list and no way to remove one thing from it

WHEN history.commentCard's head row is tapped -> the post it answers opens AND its back arrow reads Back to History

WHEN history.commentCard is tapped outside its head row and its own controls -> the post's comment section opens scrolled to that comment AND the post's back arrow beneath the thread reads Back to History

WHEN the comment glyph on a history.commentCard is tapped -> the post's comment section opens scrolled to that comment AND the reply composer opens aimed at that comment

WHEN a post's media is tapped -> the post opens as it does from the feed AND its back arrow reads Back to History

WHEN history.profileCard is tapped -> that person's profile opens AND its back arrow reads Back to History

WHEN history.tagCard is tapped -> the tag's page opens AND its back arrow reads Back to History

WHEN a card's Feed score is tapped -> the score's trace opens AND its back arrow reads Back to History

WHEN Tag a new post with it on a history.tagCard is tapped -> the post composer opens at its first stage AND the tag rides staged among the new post's tags

WHEN a press-and-hold on a card's stance face signs -> the face refuses a second press-and-hold until the signing answers AND NEVER the face moves before the signature is taken

WHEN the hold's signing has not answered 200ms after the hold -> the line under the face reads Signing… AND NEVER a spinner appears

WHEN the hold's signing answers within 200ms of the hold -> NEVER the line Signing… appears

WHEN the hold's signing is taken -> the face moves to the new opinion AND the snackbar confirms the signature

WHEN the hold's signing does not go through -> the face stays where it was AND the line under it reads That didn't sign. followed by Retry AND NEVER the snackbar carries the failure

WHEN the hold's signing is refused by the write rule -> the face stays where it was AND the line under it reads You can't sign right now. AND NEVER Retry appears AND NEVER the line takes the failure voice

ALWAYS at most one clip plays in History, by the feed's stage law

ALWAYS a veiled clip has no playback and no sound-disc presence

ALWAYS history.searchField reads Search your history at rest

WHEN the reader types in history.searchField -> History narrows to what matches AND the matches stand ordered by the time the reader first saw each thing, newest first

ALWAYS history.searchField matches by the one search rule Explore uses: names and titles, an untitled post by its first words, and never a body, a description or a bio

WHEN the query starts with @handle -> the remainder matches that person's own things in History, a comment through the title of what it answers

WHEN the query starts with #tag -> the remainder matches the things in History that carry that tag

WHEN the reader types a query nothing in History carries -> History stands narrowed to nothing, with Show everything

ALWAYS history.filterTrigger reads Everything GIVEN no kind is narrowed

WHEN tap history.filterTrigger -> the history's filter sheet opens over History

ALWAYS the order History opened in stands frozen while the reader scrolls, and a thing first seen meanwhile joins only at the next open or the next pull down

WHEN pull down GIVEN History stands all the way at its top -> History re-reads AND the platform's own refresh indicator shows

WHEN the reader scrolls back up far enough to summon the collapsing top GIVEN History is 3 viewport-heights deep or more -> the Back to top pill rides in with the top, centred under it

WHEN the reader scrolls back up far enough to summon the collapsing top GIVEN History is shallower than 3 viewport-heights -> NEVER the Back to top pill appears

WHEN tap Back to top -> the list goes to the top, animated AND NEVER History re-reads

ALWAYS the header, history.searchField and history.filterTrigger collapse on the way down and return on the way up

ALWAYS history.bottomBar rides with no slot lit

WHEN tap the back arrow -> the reader's own profile comes back, in the state it was left

ALWAYS the back arrow reads Back to your profile
