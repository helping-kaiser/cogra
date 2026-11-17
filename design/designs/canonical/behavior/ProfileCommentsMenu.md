# ProfileCommentsMenu · `spec:design:behavior-profile-comments-menu`

WHEN tap the ⋮ on profile.comments.commentCard GIVEN profile.tabRow.commentsTab is lit and the comment is someone else's -> profile.menuSheet rises over the profile, unstacked, AND the profile stands unchanged beneath its wash

ALWAYS the comment's menu on the profile reads Save or Unsave, then Cite in a new post, then Hide with the comment's author's handle, then profile.menuSheet.citedBy, then Opinions on this, then License terms, then profile.menuSheet.report at the sheet tail, the comment's menu's own rows

ALWAYS the comment's menu keeps Hide with the author's handle on the author's own profile, though the profile's own menu carries the same row

WHEN tap profile.menuSheet.hide -> the sheet closes AND the reader stays on the profile, every card in its place, AND the snackbar reads @ada is hidden. with Undo AND NEVER a confirm step appears

WHEN tap profile.menuSheet.opinions -> the menu closes AND the comment's opinions sheet comes up over the profile

WHEN tap profile.menuSheet.citedBy -> the menu closes AND what cites the comment comes up over the profile

WHEN tap profile.menuSheet.license -> the menu closes AND the comment's terms come up in a sheet over the profile

WHEN tap profile.menuSheet.report -> the menu closes AND the report confirm rises over the profile, its title reading Report this comment? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
