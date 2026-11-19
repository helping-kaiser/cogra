# TagPageCommentMenu · `spec:design:behavior-tag-page-comment-menu`

WHEN tap a tagged comment card's ⋮ on the tag's page GIVEN the comment is someone else's -> tagPage.menuSheet rises over the tag's page, unstacked, AND the page stands unchanged beneath its wash

ALWAYS tagPage.menuSheet reads Save or Unsave, then Cite in a new post, then Hide with the comment's author's handle, then tagPage.menuSheet.citedBy, then Opinions on this, then License terms, then tagPage.menuSheet.report at the sheet tail, the comment's menu's own rows

WHEN tap tagPage.menuSheet.hide -> the sheet closes AND the tag's page stands as it stood, every row in its place AND tagPage.snackbar reads @ada is hidden. with Undo AND NEVER a confirm step appears

WHEN tap tagPage.menuSheet.opinions -> the menu closes AND the comment's opinions sheet comes up over the tag's page

WHEN tap tagPage.menuSheet.citedBy -> the menu closes AND what cites the comment comes up over the tag's page

WHEN tap tagPage.menuSheet.license -> the menu closes AND the comment's terms come up in a sheet over the tag's page

WHEN tap tagPage.menuSheet.report -> the menu closes AND the report confirm rises over the tag's page, its title reading Report this comment? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
