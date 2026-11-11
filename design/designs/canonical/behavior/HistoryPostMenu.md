# HistoryPostMenu · `spec:design:behavior-history-post-menu`

WHEN tap a post card's ⋮ in History GIVEN the post is someone else's -> history.menuSheet rises over History AND History stands unchanged beneath its wash

ALWAYS history.menuSheet reads Save or Unsave, then Cite in a new post, then Hide with the author's handle, then License terms, then history.menuSheet.report at the sheet tail, the reader's post menu's own rows

ALWAYS history.menuSheet carries no row of History's own, History offering no way to remove one thing from it

WHEN tap history.menuSheet.save GIVEN the post is not kept -> the post is kept AND the sheet closes AND the snackbar reads Saved.

WHEN tap history.menuSheet.save GIVEN the post is kept -> the sheet closes AND the snackbar reads Removed from Saved. with Undo

WHEN tap history.menuSheet.cite -> the post wizard opens fresh at its first stage AND the post rides along unseen until the details stage

WHEN tap history.menuSheet.hide GIVEN the author is not hidden -> the sheet closes AND History stands as it stood, every card in its place AND history.snackbar reads @ada is hidden — their posts stay out of your feed. with Undo AND NEVER a confirm step appears

ALWAYS history.menuSheet.hide reads Unhide with the author's handle GIVEN the author is hidden, the post standing in the History that was open when the hide was made, and keeps its one name whatever it reads

WHEN tap history.menuSheet.hide GIVEN the author is hidden -> the sheet closes AND the author is unhidden AND History stands as it stood AND history.snackbar reads @ada is unhidden — their posts can reach your feed again. with Undo AND NEVER a confirm step appears

WHEN tap history.menuSheet.license -> the menu closes AND the post's terms come up in a sheet over History

WHEN tap history.menuSheet.report -> the menu closes AND the report confirm rises over History, its title reading Report this post? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
