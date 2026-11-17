# CommentRemovedMenu · `spec:design:behavior-comment-removed-menu`

WHEN tap the ⋮ on postDetail.threadSheet.commentCard GIVEN the comment is the reader's own and was removed -> postDetail.menuSheet rises over the thread, stacked, AND the thread stands unchanged beneath its wash

ALWAYS postDetail.menuSheet reads Save or Unsave, then Cite in a new post, then postDetail.menuSheet.citedBy, then Opinions on this, then License terms, the reader's own comment menu less Edit and Remove

WHEN tap postDetail.menuSheet.license -> the menu closes AND the terms the comment was published under come up over the thread, as any comment's do

WHEN tap postDetail.menuSheet.cite -> the post wizard opens fresh at its first stage AND the removed comment rides along unseen until the details stage

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes