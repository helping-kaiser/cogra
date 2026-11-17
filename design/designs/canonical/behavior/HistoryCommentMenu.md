# HistoryCommentMenu · `spec:design:behavior-history-comment-menu`

WHEN tap the ⋮ on history.commentCard GIVEN the comment is someone else's -> history.menuSheet rises over History, unstacked, AND History stands unchanged beneath its wash

ALWAYS history.menuSheet reads Save or Unsave, then Cite in a new post, then Hide with the comment's author's handle, then history.menuSheet.citedBy, then Opinions on this, then License terms, then history.menuSheet.report at the sheet tail, the comment's menu's own rows

WHEN tap history.menuSheet.hide GIVEN the author is not hidden -> the sheet closes AND History stands as it stood, every card in its place AND history.snackbar reads @ada is hidden. with Undo AND NEVER a confirm step appears

ALWAYS history.menuSheet.hide reads Unhide with the comment's author's handle GIVEN the author is hidden, the comment standing in the History that was open when the hide was made, and keeps its one name whatever it reads

WHEN tap history.menuSheet.hide GIVEN the author is hidden -> the sheet closes AND the author is unhidden AND History stands as it stood AND history.snackbar reads @ada is unhidden. with Undo AND NEVER a confirm step appears

WHEN tap history.menuSheet.opinions -> the menu closes AND the comment's opinions sheet comes up over History

WHEN tap history.menuSheet.citedBy -> the menu closes AND what cites the comment comes up over History

WHEN tap history.menuSheet.license -> the menu closes AND the comment's terms come up in a sheet over History

WHEN tap history.menuSheet.report -> the menu closes AND the report confirm rises over History, its title reading Report this comment? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
