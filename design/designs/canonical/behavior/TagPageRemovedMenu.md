# TagPageRemovedMenu · `spec:design:behavior-tag-page-removed-menu`

WHEN tap a tagged post card's ⋮ on the tag's page GIVEN the post is someone else's and was removed -> tagPage.menuSheet rises over the tag's page AND the page stands unchanged beneath its wash

ALWAYS tagPage.menuSheet reads Save or Unsave, then Cite in a new post, then Hide with the author's handle, then tagPage.menuSheet.citedBy, then Opinions on this, then License terms, then tagPage.menuSheet.report at the sheet tail, the reader's post menu whole GIVEN the post was removed, by its author or by a passed proposal

ALWAYS the rows read the same whichever removed the post, its author or a passed proposal

WHEN tap tagPage.menuSheet.save -> the removed post is kept as any post is kept AND the sheet closes

WHEN tap tagPage.menuSheet.hide -> the sheet closes AND the tag's page stands as it stood, every row in its place AND tagPage.snackbar reads @tobias is hidden. with Undo AND NEVER a confirm step appears

WHEN tap tagPage.menuSheet.license -> the menu closes AND the terms the post was published under come up over the tag's page, as any post's do

WHEN tap tagPage.menuSheet.report -> the menu closes AND the report confirm rises over the tag's page, its title reading Report this post? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
