# CommentRemovedOtherMenu · `spec:design:behavior-comment-removed-other-menu`

WHEN tap the ⋮ on postDetail.threadSheet.commentCard GIVEN the comment is someone else's and was removed -> postDetail.menuSheet rises over the thread, stacked, AND the thread stands unchanged beneath its wash

ALWAYS postDetail.menuSheet reads Save or Unsave, then Cite in a new post, then Hide with the comment's author's handle, then postDetail.menuSheet.citedBy, then Opinions on this, then License terms, then postDetail.menuSheet.report at the sheet tail, the reader's comment menu whole

WHEN tap postDetail.menuSheet.hide -> the menu closes AND the thread stands as it was, the removed comment's mark and its replies in their place AND postDetail.snackbar reads @tobias is hidden. with Undo AND NEVER a confirm step appears

WHEN tap postDetail.menuSheet.license -> the menu closes AND the terms the comment was published under come up over the thread, as any comment's do

WHEN tap postDetail.menuSheet.report -> the menu closes AND the report confirm rises over the thread AND NEVER anything is sent yet

WHEN a guest taps Save, Cite in a new post, Hide or Report -> the guest gate opens AND NEVER postDetail.menuSheet.citedBy, Opinions on this or License terms raise it

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
