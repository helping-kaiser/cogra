# CommentMenuOwn · `spec:design:behavior-comment-menu-own`

ALWAYS the reader's own comment's menu reads Save or Unsave, then Cite in a new post, then Remove, then postDetail.menuSheet.citedBy, then Opinions on this, then License terms

ALWAYS the reader's own comment's menu opens stacked over the thread GIVEN it was opened in the thread, the thread scrolled to the comment beneath it

ALWAYS the reader's own comment's menu opens unstacked over its host GIVEN it was opened from a comment's ⋮ in a list, the own profile's Comments tab, History or Saved

ALWAYS the menu carries no Report row, the own menus' rule

ALWAYS postDetail.threadSheet.commentCard wears Edit in its row GIVEN the comment is the reader's own, and so does the reader's own comment wherever it stands — a list, the own profile's Comments tab, History and Saved — and the menu carries no Edit row, the row's Edit being the one door to the edit

WHEN tap Edit on the reader's own comment -> the comment's edit opens over the surface the comment stands on

WHEN tap Save -> the reader's own comment is kept in the one Saved list beside posts and people AND the menu closes AND the snackbar reads Saved.

WHEN tap Unsave -> the menu closes AND postDetail.snackbar reads Removed from Saved. with Undo on postDetail.snackbar.action

WHEN tap Remove -> the menu closes AND the think-twice dialog comes up over the surface the menu was opened on, the thread or the host

WHEN tap the scrim, swipe the menu down, press system Back or press Escape -> the menu closes AND the surface it was opened on stands beneath it as it was
