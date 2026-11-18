# HistoryRemovedMenu · `spec:design:behavior-history-removed-menu`

WHEN tap the ⋮ of a removed post's card in History GIVEN the post is another's -> history.menuSheet rises over History AND History stands unchanged beneath its wash

ALWAYS history.menuSheet reads Save or Unsave, then Cite in a new post, then Hide with the author's handle, then history.menuSheet.citedBy, then Opinions on this, then License terms, then history.menuSheet.report at the sheet tail, the reader's post menu whole GIVEN the post was removed, by its author or by a passed proposal

ALWAYS the rows read the same whichever removed the post, its author or a passed proposal

WHEN tap history.menuSheet.save -> the removed post is kept as any post is kept AND the sheet closes

WHEN tap history.menuSheet.hide GIVEN the author is not hidden -> the sheet closes AND History stands as it stood, every card in its place AND history.snackbar reads @ada is hidden. with Undo AND NEVER a confirm step appears

WHEN tap history.menuSheet.license -> the menu closes AND the terms the post was published under come up over History, as any post's do

WHEN tap history.menuSheet.report -> the menu closes AND the report confirm rises over History, its title reading Report this post? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
