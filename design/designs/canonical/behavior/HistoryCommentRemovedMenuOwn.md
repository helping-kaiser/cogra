# HistoryCommentRemovedMenuOwn · `spec:design:behavior-history-comment-removed-menu-own`

WHEN tap the ⋮ on history.commentCard GIVEN the comment is the reader's own and was removed -> history.menuSheet rises over History, unstacked, AND History stands unchanged beneath its wash

ALWAYS history.commentCard.removalMark.line reads Removed by its author where the comment's words were

ALWAYS history.menuSheet reads Save or Unsave, then Cite in a new post, then history.menuSheet.citedBy, then Opinions on this, then License terms, the reader's own comment menu less Edit and Remove

WHEN tap history.menuSheet.license -> the menu closes AND the terms the comment was published under come up over History, as any comment's do

WHEN tap history.menuSheet.opinions -> the menu closes AND the comment's opinions sheet comes up over History

WHEN tap history.menuSheet.citedBy -> the menu closes AND what cites the comment comes up over History

WHEN tap history.menuSheet.cite -> the post wizard opens as New post opens it, fresh at its first stage or, with a draft kept on this device, under the draft card, whose Continue takes what rides along into the draft AND the removed comment rides along unseen until the details stage

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
