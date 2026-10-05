# CommentNotFound · `spec:design:behavior-comment-not-found`

WHEN a shared comment link, a notification or a search result opens a comment GIVEN its id resolves to nothing -> the whole screen reads This comment doesn't exist. AND the header carries its back arrow with no title and no menu AND NEVER a thread opens

ALWAYS the screen is the answer no, never the failure voice and never a fault line

ALWAYS nothing on the screen retries and nothing on it acts on a comment

ALWAYS a removed comment never reaches this screen: it keeps its place in its thread under its mark, its replies kept under it

WHEN press the header back arrow or the system's Back GIVEN the link opened over the app's state -> exactly that state comes back

WHEN press the header back arrow or the system's Back GIVEN the link opened the app cold -> the feed's root opens

ALWAYS the back arrow reads Back to feed GIVEN the link opened the app cold

WHEN tap the bottom bar's Feed -> the feed opens

WHEN tap the bottom bar's Explore -> Explore opens

WHEN tap the bottom bar's New post -> a new post's pick stage opens

WHEN tap the bottom bar's Wallet -> the wallet's coming-soon door opens

WHEN tap the bottom bar's Profile -> the reader's own profile opens
