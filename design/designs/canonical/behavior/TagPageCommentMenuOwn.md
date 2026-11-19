# TagPageCommentMenuOwn · `spec:design:behavior-tag-page-comment-menu-own`

WHEN tap a tagged comment card's ⋮ on the tag's page GIVEN the comment is the reader's own -> tagPage.menuSheet rises over the tag's page, unstacked, AND the page stands unchanged beneath its wash

ALWAYS tagPage.menuSheet reads Save or Unsave, then Cite in a new post, then Edit, then Remove, then tagPage.menuSheet.citedBy, then Opinions on this, then License terms, the own comment menu's rows, and carries no Hide and no Report row

WHEN tap tagPage.menuSheet.edit -> the menu closes AND the comment's edit opens over the tag's page

WHEN tap tagPage.menuSheet.remove -> the menu closes AND the think-twice dialog comes up over the tag's page

WHEN tap tagPage.menuSheet.opinions -> the menu closes AND the comment's opinions sheet comes up over the tag's page

WHEN tap tagPage.menuSheet.citedBy -> the menu closes AND what cites the comment comes up over the tag's page

WHEN tap tagPage.menuSheet.license -> the menu closes AND the comment's terms come up in a sheet over the tag's page

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
