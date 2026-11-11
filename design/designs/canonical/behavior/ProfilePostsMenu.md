# ProfilePostsMenu · `spec:design:behavior-profile-posts-menu`

WHEN tap the ⋮ on profile.posts.card GIVEN profile.tabRow.postsTab is lit and the post is someone else's -> profile.menuSheet rises over the profile AND the profile stands unchanged beneath its wash

ALWAYS the post card's menu on the profile reads Save or Unsave, then Cite in a new post, then Hide with the author's handle, then License terms, then profile.menuSheet.report at the sheet tail, the reader's post menu's own rows

ALWAYS the post card's menu keeps Hide with the author's handle on the author's own profile, though the profile's own menu carries the same row

WHEN tap profile.menuSheet.hide -> the sheet closes AND the reader stays on the profile AND the snackbar reads @ada is hidden — their posts stay out of your feed. with Undo AND NEVER a confirm step appears

WHEN tap profile.menuSheet.license -> the menu closes AND the post's terms come up in a sheet over the profile

WHEN tap profile.menuSheet.report -> the menu closes AND the report confirm rises over the profile, its title reading Report this post? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
