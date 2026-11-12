# TagPageMenu · `spec:design:behavior-tag-page-menu`

WHEN tap a tagged post card's ⋮ on the tag's page -> tagPage.menuSheet rises over the tag's page AND the page stands unchanged beneath its wash

ALWAYS tagPage.menuSheet reads Save or Unsave, then Cite in a new post, then Hide with the author's handle, then License terms, then tagPage.menuSheet.report at the sheet tail, the reader's post menu's own rows

WHEN tap tagPage.menuSheet.hide -> the sheet closes AND the tag's page stands as it stood, every row in its place AND tagPage.snackbar reads @tobias is hidden — their posts stay out of your feed. with Undo AND NEVER a confirm step appears

WHEN tap tagPage.menuSheet.license -> the menu closes AND the post's terms come up in a sheet over the tag's page

WHEN tap tagPage.menuSheet.report -> the menu closes AND the report confirm rises over the tag's page, its title reading Report this post? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes

ALWAYS tagPage.menuSheet.hide reads Unhide with the author's handle GIVEN the author is already hidden, the hidden author's post still standing here, and keeps its one name whatever it reads, as the reader's post menu reads it
