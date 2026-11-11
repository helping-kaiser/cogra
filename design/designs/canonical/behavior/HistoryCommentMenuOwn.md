# HistoryCommentMenuOwn · `spec:design:behavior-history-comment-menu-own`

WHEN tap the ⋮ on history.commentCard GIVEN the comment is the reader's own -> history.menuSheet rises over History, unstacked, AND History stands unchanged beneath its wash

ALWAYS history.menuSheet reads Save or Unsave, then Cite in a new post, then Remove, then history.menuSheet.citedBy, then Opinions on this, then License terms, the own comment menu's rows, and carries no Report row

WHEN tap history.menuSheet.remove -> the menu closes AND the think-twice dialog comes up over History

WHEN tap history.menuSheet.opinions -> the menu closes AND the comment's opinions sheet comes up over History

WHEN tap history.menuSheet.citedBy -> the menu closes AND what cites the comment comes up over History

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
