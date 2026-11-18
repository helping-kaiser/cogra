# ProfilePostsRemovedMenuOwn · `spec:design:behavior-profile-posts-removed-menu-own`

WHEN tap the ⋮ on profile.posts.card GIVEN the profile is the reader's own, profile.tabRow.postsTab is lit and the card is the reader's own removed post -> profile.menuSheet rises over the reader's own profile AND the profile stands unchanged beneath its wash

ALWAYS profile.menuSheet reads Save or Unsave, then Cite in a new post, then profile.menuSheet.citedBy, then Opinions on this, then License terms, your own post's menu less Edit, Mark as sensitive and Remove

WHEN tap profile.menuSheet.license -> the menu closes AND the terms the post was published under come up over the profile, as any post's do

WHEN tap profile.menuSheet.save -> the removed post is kept as any post is kept AND the sheet closes

WHEN tap profile.menuSheet.cite -> the post wizard opens as New post opens it, fresh at its first stage or, with a draft kept on this device, under the draft card, whose Continue takes what rides along into the draft AND the removed post rides along unseen until the details stage

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
