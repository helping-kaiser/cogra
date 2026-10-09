# CommentMenu · `spec:design:behavior-comment-menu`

ALWAYS the comment's menu opens stacked over the thread, its wash between the two sheets and the thread's top still in view

ALWAYS the comment's menu reads Save or Unsave, then Cite in a new post, then postDetail.menuSheet.citedBy, then Opinions on this, then License terms, then postDetail.menuSheet.report at the sheet tail

ALWAYS the comment's menu carries no Hide row

ALWAYS the comment's menu's first row reads Unsave GIVEN the comment is kept

WHEN tap Save -> the comment is kept in the one Saved list beside posts and people AND the menu closes AND the snackbar reads Saved.

WHEN tap Save GIVEN the save does not go through -> the save reverts AND the target's row says so with Retry

WHEN tap Unsave -> the menu closes AND the snackbar reads Removed from Saved. with Undo

WHEN tap Cite in a new post -> the post wizard opens fresh at its first stage AND the comment rides along unseen until the details stage

WHEN tap Opinions on this -> the menu closes AND the comment's opinions sheet comes up over the thread

WHEN tap postDetail.menuSheet.citedBy -> the menu closes AND what cites the comment comes up over the thread

ALWAYS Opinions on this and postDetail.menuSheet.citedBy stand in the comment's menu whatever their counts

WHEN tap License terms -> the menu closes AND the comment's terms come up in a sheet over the thread

WHEN tap postDetail.menuSheet.report -> the menu closes AND postDetail.reportSheet rises stacked over the thread, its postDetail.reportSheet.title reading Report this comment? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the menu down, press system Back or press Escape -> the menu closes AND the thread stands open beneath it as it was
