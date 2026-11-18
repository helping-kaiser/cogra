# TagPageRemovedMenuOwn · `spec:design:behavior-tag-page-removed-menu-own`

WHEN tap a tagged post card's ⋮ on the tag's page GIVEN the post is the reader's own and was removed -> tagPage.menuSheet rises over the tag's page AND the page stands unchanged beneath its wash

ALWAYS tagPage.menuSheet reads Save or Unsave, then Cite in a new post, then tagPage.menuSheet.citedBy, then Opinions on this, then License terms, your own post's menu less Edit, Mark as sensitive and Remove

WHEN tap tagPage.menuSheet.save -> the removed post is kept as any post is kept AND the sheet closes

WHEN tap tagPage.menuSheet.license -> the menu closes AND the terms the post was published under come up over the tag's page, as any post's do

WHEN tap tagPage.menuSheet.cite -> the post wizard opens as New post opens it, fresh at its first stage or, with a draft kept on this device, under the draft card, whose Continue takes what rides along into the draft AND the removed post rides along unseen until the details stage

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
