# ProfileCommentsOwn · `spec:design:behavior-profile-comments-own`

ALWAYS the reader's own profile's Comments view keeps the own profile's head as the profile's own page draws it, the band, the header with Edit profile and Invites, and profile.tabRow.commentsTab lit

ALWAYS profile.comments lists the reader's own comments, each a profile.comments.commentCard in reach of its thread

ALWAYS a comment's row wears Edit, as in the thread, and its ⋮ holds the own comment menu, with no Edit row and no Report row

WHEN tap Edit on a comment -> the comment's edit opens

WHEN tap the ⋮ on profile.comments.commentCard -> profile.menuSheet rises over the reader's own profile with the own comment menu's rows

WHEN tap profile.comments.commentCard.target -> the thread it lives in opens scrolled to that comment

WHEN tap profile.tabRow.postsTab -> the reader's own posts stand below profile.tabRow AND the head above stays as it was

WHEN tap profile.tabRow.everythingTab -> the reader's own chronicle stands below profile.tabRow AND the head above stays as it was

WHEN tap profile.tabRow.commentsTab -> NEVER anything changes
