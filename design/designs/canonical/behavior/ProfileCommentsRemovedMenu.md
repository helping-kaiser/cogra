# ProfileCommentsRemovedMenu · `spec:design:behavior-profile-comments-removed-menu`

WHEN tap the ⋮ on profile.comments.commentCard GIVEN the comment is someone else's and was removed -> profile.menuSheet rises over the profile, unstacked, AND the profile stands unchanged beneath its wash

ALWAYS profile.menuSheet reads Save or Unsave, then Cite in a new post, then profile.menuSheet.citedBy, then Opinions on this, then License terms, then profile.menuSheet.report at the sheet tail, the reader's comment menu whole

WHEN tap profile.menuSheet.license -> the menu closes AND the terms the comment was published under come up over the profile, as any comment's do

WHEN a guest taps Save, Cite in a new post or Report -> the guest gate opens AND NEVER profile.menuSheet.citedBy, Opinions on this or License terms raise it

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes