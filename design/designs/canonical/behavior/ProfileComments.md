# ProfileComments · `spec:design:behavior-profile-comments`

ALWAYS profile.comments lists the person's comments, each a profile.comments.commentCard in reach of its thread

ALWAYS profile.comments.commentCard leads with profile.comments.commentCard.target, the pointer to what it answers

ALWAYS a removed comment keeps its place in the list, profile.comments.commentCard.removalMark.line reading Removed by its author where its words were, over profile.comments.commentCard.removalMark.detail reading The comment's place in the thread, and every response, remain.

ALWAYS a removed comment keeps profile.comments.commentCard.authorChip, its time and profile.comments.commentCard.target, and carries no profile.comments.commentCard.menu

ALWAYS profile.comments.empty below profile.tabRow reads Nothing here yet., the line alone, GIVEN the person has written no comment

WHEN the tab's first page has not arrived 200ms after it was asked for -> profile.comments.loading stands in the list's place, reading Loading… AND NEVER profile.comments.empty stands meanwhile AND NEVER a skeleton card or a spinner appears

WHEN the tab's first page does not arrive -> profile.comments.moreFault stands where the list would stand, reading Couldn't load more, then profile.comments.moreFault.retry as an inline action AND NEVER the line takes the error colour AND NEVER a full-tab fault stands

WHEN the first page has not arrived 200ms after profile.comments.moreFault.retry is tapped -> Loading… stands in the row's place AND NEVER a spinner appears

WHEN the retried first page arrives -> its cards stand below profile.tabRow AND profile.comments.moreFault goes

ALWAYS profile.comments.commentCard.removalMark.when reads the removal's own moment under the mark, in the one age vocabulary, never the comment's age, GIVEN the comment was removed

ALWAYS the header block above profile.tabRow stands unchanged in every tab view, and only the list below profile.tabRow changes

ALWAYS the ⋮ closes the actions row and holds the whole profile menu, as the profile's own page does

ALWAYS the header bar carries the way back alone, titled with the person's handle

WHEN tap profile.tabRow.postsTab -> the person's posts stand below profile.tabRow AND the header above stays as it was

WHEN tap profile.tabRow.everythingTab -> the person's chronicle stands below profile.tabRow AND the header above stays as it was

WHEN tap profile.tabRow.commentsTab -> NEVER anything changes

WHEN tap profile.comments.commentCard.authorChip on one of the person's own comments -> NEVER anything changes

WHEN tap profile.comments.commentCard.target -> the thread it lives in opens scrolled to that comment

WHEN tap Reply on a comment -> the thread the comment lives in opens scrolled to that comment

WHEN tap profile.comments.viewReplies -> the thread the comment lives in opens scrolled to that comment

WHEN tap Reply on a comment GIVEN the reader is an applicant -> the snackbar reads You can comment once you're in. AND NEVER the thread's composer opens

WHEN tap a comment's ⋮ GIVEN the comment is the reader's own -> the own comment's menu opens

WHEN tap a comment's ⋮ GIVEN the comment is someone else's -> the comment's menu opens

WHEN tap the ⋮ in the actions row -> the profile's menu opens over the page

WHEN tap the Opinions on figure -> the opinions page opens on this profile on its On state

WHEN tap the Opinions by figure -> the opinions page opens on this profile on its By state

WHEN tap the Posts figure -> NEVER anything happens

WHEN tap Message -> the chats coming-soon screen opens

WHEN a guest taps Message -> the guest gate opens

WHEN a guest taps the profile's stance anchor -> the guest gate opens

WHEN tap the back arrow -> the reader returns to where they came from, in the state they left it AND the arrow's label names that origin

ALWAYS the back arrow reads Back to feed from the feed in any of its states, Back to the post from a post's author, opinions or references, Back to the comments from the comments sheet, Back to the stream from the stream, Back to Notifications from Notifications, Back to Saved from Saved, Back to History from History, Back to the opinions from a profile's opinions list, Back to the profile from a card on another's profile, Back to your profile from a card on the reader's own, Back to the search from Explore mid-query, Back to Invites from the people you let in on Invites and Back to with the tag's name from a tag's page

ALWAYS the back arrow reads Back to feed and leads to the feed GIVEN the profile was entered with no history behind it

WHEN pull down GIVEN the comments view stands all the way at its top -> the profile refreshes AND the platform's own refresh indicator shows

ALWAYS profile.bottomBar keeps lit the slot of the root the profile was opened from, profile.bottomBar.feedSlot from the feed
