# TagPageCommentRemovedMenuOwn · `spec:design:behavior-tag-page-comment-removed-menu-own`

WHEN tap a tagged comment card's ⋮ on the tag's page GIVEN the comment is the reader's own and was removed -> tagPage.menuSheet rises over the tag's page, unstacked, AND the page stands unchanged beneath its wash

ALWAYS tagPage.menuSheet reads Save or Unsave, then Cite in a new post, then tagPage.menuSheet.citedBy, then Opinions on this, then License terms, the reader's own comment menu less Edit and Remove

WHEN tap tagPage.menuSheet.license -> the menu closes AND the terms the comment was published under come up over the tag's page, as any comment's do

WHEN tap tagPage.menuSheet.opinions -> the menu closes AND the comment's opinions sheet comes up over the tag's page

WHEN tap tagPage.menuSheet.citedBy -> the menu closes AND what cites the comment comes up over the tag's page

WHEN tap tagPage.menuSheet.cite -> the post wizard opens as New post opens it, fresh at its first stage or, with a draft kept on this device, under the draft card, whose Continue takes what rides along into the draft AND the removed comment rides along unseen until the details stage

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
