# TagPageMenuOwn · `spec:design:behavior-tag-page-menu-own`

WHEN tap a tagged post card's ⋮ on the tag's page GIVEN the post is the reader's own -> tagPage.menuSheet rises over the tag's page AND the page stands unchanged beneath its wash

ALWAYS tagPage.menuSheet reads Save or Unsave, then Cite in a new post, then Edit, then Mark as sensitive, then Remove, then tagPage.menuSheet.citedBy, then Opinions on this, then License terms, the own post menu's rows, and carries no Hide and no Report row

WHEN tap tagPage.menuSheet.edit -> the post's edit opens

WHEN tap tagPage.menuSheet.markSensitive -> the post's edit opens AND NEVER the post is marked without the edit's signing

WHEN tap tagPage.menuSheet.remove -> the menu closes AND the think-twice dialog comes up over the tag's page

WHEN tap tagPage.menuSheet.license -> the menu closes AND the post's terms come up in a sheet over the tag's page

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
