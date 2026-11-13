# ProfileCommentsOwn · `spec:design:behavior-profile-comments-own`

ALWAYS the reader's own profile's Comments view keeps the own profile's head as the profile's own page draws it, the band, the header with Edit profile and Invites, and profile.tabRow.commentsTab lit

ALWAYS profile.comments lists the reader's own comments, each a profile.comments.commentCard in reach of its thread

ALWAYS a comment's ⋮ holds the own comment menu, Edit among its rows and no Report row, and the card carries no Edit button

WHEN tap the ⋮ on profile.comments.commentCard -> profile.menuSheet rises over the reader's own profile with the own comment menu's rows

WHEN tap profile.comments.commentCard.target -> the thread it lives in opens scrolled to that comment

WHEN tap profile.tabRow.postsTab -> the reader's own posts stand below profile.tabRow AND the head above stays as it was

WHEN tap profile.tabRow.everythingTab -> the reader's own chronicle stands below profile.tabRow AND the head above stays as it was

WHEN tap profile.tabRow.commentsTab -> NEVER anything changes

ALWAYS profile.comments.empty below profile.tabRow reads Nothing here yet., the line alone, GIVEN the reader has written no comment, an applicant's own tab as a member's, only Everything carrying the applicant's own line

WHEN the tab's first page has not arrived 200ms after it was asked for -> profile.comments.loading stands in the list's place, reading Loading… AND NEVER profile.comments.empty stands meanwhile AND NEVER a skeleton card or a spinner appears

WHEN the tab's first page does not arrive -> profile.comments.moreFault stands where the list would stand, reading Couldn't load more, then profile.comments.moreFault.retry as an inline action AND NEVER the line takes the error colour AND NEVER a full-tab fault stands

WHEN the first page has not arrived 200ms after profile.comments.moreFault.retry is tapped -> Loading… stands in the row's place AND NEVER a spinner appears

WHEN the retried first page arrives -> its cards stand below profile.tabRow AND profile.comments.moreFault goes
