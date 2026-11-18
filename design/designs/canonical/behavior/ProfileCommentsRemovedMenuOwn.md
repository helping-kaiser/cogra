# ProfileCommentsRemovedMenuOwn · `spec:design:behavior-profile-comments-removed-menu-own`

WHEN tap the ⋮ on profile.comments.commentCard GIVEN the profile is the reader's own, profile.tabRow.commentsTab is lit and the comment is the reader's own and was removed -> profile.menuSheet rises over the reader's own profile, unstacked, AND the profile stands unchanged beneath its wash

ALWAYS profile.menuSheet reads Save or Unsave, then Cite in a new post, then profile.menuSheet.citedBy, then Opinions on this, then License terms, the reader's own comment menu less Edit and Remove

WHEN tap profile.menuSheet.license -> the menu closes AND the terms the comment was published under come up over the profile, as any comment's do

WHEN tap profile.menuSheet.opinions -> the menu closes AND the comment's opinions sheet comes up over the profile

WHEN tap profile.menuSheet.citedBy -> the menu closes AND what cites the comment comes up over the profile

WHEN tap profile.menuSheet.cite -> the post wizard opens as New post opens it, fresh at its first stage or, with a draft kept on this device, under the draft card, whose Continue takes what rides along into the draft AND the removed comment rides along unseen until the details stage

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
