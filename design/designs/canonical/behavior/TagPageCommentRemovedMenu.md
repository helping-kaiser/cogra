# TagPageCommentRemovedMenu · `spec:design:behavior-tag-page-comment-removed-menu`

WHEN tap a tagged comment card's ⋮ on the tag's page GIVEN the comment is someone else's and was removed -> tagPage.menuSheet rises over the tag's page, unstacked, AND the page stands unchanged beneath its wash

ALWAYS tagPage.menuSheet reads Save or Unsave, then Cite in a new post, then Hide with the comment's author's handle, then tagPage.menuSheet.citedBy, then Opinions on this, then License terms, then tagPage.menuSheet.report at the sheet tail, the reader's comment menu whole GIVEN the comment was removed, by its author or by a passed proposal

ALWAYS the rows read the same whichever removed the comment, its author or a passed proposal

WHEN tap tagPage.menuSheet.save -> the removed comment is kept as any comment is kept AND the sheet closes

WHEN tap tagPage.menuSheet.hide -> the sheet closes AND the tag's page stands as it stood, the removed comment's mark in its place AND tagPage.snackbar reads @ada is hidden. with Undo AND NEVER a confirm step appears

WHEN tap tagPage.menuSheet.license -> the menu closes AND the terms the comment was published under come up over the tag's page, as any comment's do

WHEN tap tagPage.menuSheet.report -> the menu closes AND the report confirm rises over the tag's page, its title reading Report this comment? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
