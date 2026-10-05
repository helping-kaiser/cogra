# PostNotFound · `spec:design:behavior-post-not-found`

WHEN a shared post link or a notification opens a post GIVEN its id resolves to nothing -> the whole screen reads This post doesn't exist. AND the header carries its back arrow with no title and no menu

ALWAYS the screen is the answer no, never the failure voice and never a fault line

ALWAYS nothing on the screen retries and nothing on it acts on a post

ALWAYS a removed post never reaches this screen: it keeps its place and stands as its mark

WHEN press the header back arrow or the system's Back GIVEN the link opened over the app's state -> exactly that state comes back

WHEN press the header back arrow or the system's Back GIVEN the link opened the app cold -> the feed's root opens

ALWAYS the back arrow reads Back to feed GIVEN the link opened the app cold

WHEN tap the bottom bar's Feed -> the feed opens

WHEN tap the bottom bar's Explore -> Explore opens

WHEN tap the bottom bar's New post -> a new post's pick stage opens

WHEN tap the bottom bar's Wallet -> the wallet's coming-soon door opens

WHEN tap the bottom bar's Profile -> the reader's own profile opens
