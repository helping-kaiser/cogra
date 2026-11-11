# HistoryCommentMenu · `spec:design:behavior-history-comment-menu`

WHEN tap the ⋮ on history.commentCard GIVEN the comment is someone else's -> history.menuSheet rises over History, unstacked, AND History stands unchanged beneath its wash

ALWAYS history.menuSheet reads Save or Unsave, then Cite in a new post, then history.menuSheet.citedBy, then Opinions on this, then License terms, then history.menuSheet.report at the sheet tail, the comment's menu's own rows

ALWAYS the comment's menu carries no Hide row

WHEN tap history.menuSheet.opinions -> the menu closes AND the comment's opinions sheet comes up over History

WHEN tap history.menuSheet.citedBy -> the menu closes AND what cites the comment comes up over History

WHEN tap history.menuSheet.license -> the menu closes AND the comment's terms come up in a sheet over History

WHEN tap history.menuSheet.report -> the menu closes AND the report confirm rises over History, its title reading Report this comment? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
