# ReaderPostMenu · `spec:design:behavior-reader-post-menu`

ALWAYS the reader's post menu reads Save or Unsave, then Cite in a new post, then Hide with the author's handle, then License terms

ALWAYS the menu's first row reads Save GIVEN the post is not kept

ALWAYS the menu's first row reads Unsave GIVEN the post is kept

ALWAYS the post's card shows no saved mark anywhere

WHEN tap Save -> the post is kept AND the sheet closes AND the snackbar reads Saved.

WHEN tap Save GIVEN the save does not go through -> the save reverts AND the target's row says so with Retry

WHEN tap Unsave -> the sheet closes AND the snackbar reads Removed from Saved. with Undo

WHEN tap Hide with the author's handle GIVEN the menu was opened from the post being read -> the sheet closes AND the reader stays on the post being read AND the snackbar reads @ada is hidden — their posts stay out of your feed. with Undo AND NEVER a confirm step appears

WHEN tap Hide with the author's handle GIVEN the hide does not go through -> the hide reverts AND the target's row says so with Retry

WHEN tap Cite in a new post -> the post wizard opens fresh at its first stage AND the post rides along unseen until the details stage

WHEN tap License terms -> the menu closes AND the post's terms come up in a sheet over the surface the menu was opened from

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
