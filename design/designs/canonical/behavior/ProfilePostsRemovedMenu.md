# ProfilePostsRemovedMenu · `spec:design:behavior-profile-posts-removed-menu`

WHEN tap the ⋮ on profile.posts.card GIVEN profile.tabRow.postsTab is lit and the post is someone else's and was removed -> profile.menuSheet rises over the profile AND the profile stands unchanged beneath its wash

ALWAYS profile.menuSheet reads Save or Unsave, then Cite in a new post, then Hide with the author's handle, then profile.menuSheet.citedBy, then Opinions on this, then License terms, then profile.menuSheet.report at the sheet tail, the reader's post menu whole GIVEN the post was removed, by its author or by a passed proposal

ALWAYS the rows read the same whichever removed the post, its author or a passed proposal

WHEN tap profile.menuSheet.save -> the removed post is kept as any post is kept AND the sheet closes

WHEN tap profile.menuSheet.hide -> the sheet closes AND the reader stays on the profile, the removed post's mark in its place, AND the snackbar reads @ada is hidden. with Undo AND NEVER a confirm step appears

WHEN tap profile.menuSheet.license -> the menu closes AND the terms the post was published under come up over the profile, as any post's do

WHEN tap profile.menuSheet.report -> the menu closes AND the report confirm rises over the profile, its title reading Report this post? AND NEVER anything is sent yet

WHEN a guest taps Save, Cite in a new post, Hide or Report -> the guest gate opens AND NEVER profile.menuSheet.citedBy, Opinions on this or License terms raise it

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
