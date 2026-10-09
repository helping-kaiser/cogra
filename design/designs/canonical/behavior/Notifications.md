# Notifications · `spec:design:behavior-notifications`

ALWAYS Notifications is one flat list, newest first, with no grouping

ALWAYS every row is one actor doing one thing at one moment, written as a sentence with the actor's handle as its subject

ALWAYS a row notifies only an act someone else made that reached something of the reader's, and nothing the reader did themselves

ALWAYS an opinion on the reader's content never notifies, and only an opinion on the reader's profile does

ALWAYS the rows read @ada commented on your post, @tobias replied to your comment, @sol gave an opinion on you, @mira mentioned you, @ada cited your post, @rafa is ready for your approval, @juno landed through your invite, @mira approved your application and @kel closed your application, one sentence per kind

ALWAYS a comment's and a reply's row carries the words that arrived as its second line

ALWAYS a mention's and a citation's row reads in with the title of the piece that carries it as its second line

ALWAYS the opinion row wears the opinion's face where a picture would go, with no digits in either reading mode, and carries no second line

ALWAYS the ready-for-your-approval row wears the monogram from the applicant's handle, never a picture

ALWAYS a row not yet opened wears the unread dot on its trailing edge under its age, spoken as New

ALWAYS Notifications offers no mark-all control

ALWAYS the header collapses on the way down and returns on the way up

ALWAYS the bottom bar keeps lit the slot of the root the bell was tapped on, Feed from the feed

WHEN Notifications opens -> the bell's dot clears AND every row not yet opened keeps its own dot

WHEN tap a row -> that row's dot clears

WHEN tap a comment's or a reply's row -> the thread opens landed on that comment

WHEN tap a mention's or a citation's row -> the post that carries it opens AND its back arrow reads Back to Notifications

WHEN tap the opinion row -> the profile of the person who gave it opens AND its back arrow reads Back to Notifications

WHEN tap a landed-through-your-invite row -> the new member's profile opens AND its back arrow reads Back to Notifications

WHEN tap an application-approved row -> the approver's profile opens AND its back arrow reads Back to Notifications

WHEN tap a ready-for-your-approval row -> Invites opens on the application as it now stands AND NEVER a notice says it moved on

WHEN tap an application-closed row -> the applicant's own feed opens with the closed application's card

WHEN tap the back arrow -> the root the bell was tapped on comes back, in the state it was left

ALWAYS the back arrow reads Back to feed, Back to Explore, Back to Wallet or Back to your profile, by the root the bell was tapped on
