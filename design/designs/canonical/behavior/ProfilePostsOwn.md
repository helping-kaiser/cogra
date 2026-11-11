# ProfilePostsOwn · `spec:design:behavior-profile-posts-own`

ALWAYS the reader's own profile's Posts view keeps the own profile's head as the profile's own page draws it, the band, the header with Edit profile and Invites, and profile.tabRow.postsTab lit

ALWAYS profile.posts lists the reader's own posts, each card the feed's own, fully live

ALWAYS the ⋮ on a card holds the own post menu, Edit among its rows, and carries no Hide and no Report row

WHEN tap the ⋮ on profile.posts.card -> profile.menuSheet rises over the reader's own profile with the own post menu's rows

WHEN tap profile.tabRow.commentsTab -> the reader's own comments stand below profile.tabRow AND the head above stays as it was

WHEN tap profile.tabRow.everythingTab -> the reader's own chronicle stands below profile.tabRow AND the head above stays as it was

WHEN tap profile.tabRow.postsTab -> NEVER anything changes

WHEN tap Edit profile -> the profile edit opens
