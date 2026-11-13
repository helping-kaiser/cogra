# ReaderPostMenu · `spec:design:behavior-reader-post-menu`

ALWAYS the reader's post menu reads Save or Unsave, then Cite in a new post, then Hide with the author's handle, then postDetail.menuSheet.citedBy, then Opinions on this, then License terms, then postDetail.menuSheet.report at the sheet tail

ALWAYS the menu's first row reads Save GIVEN the post is not kept

ALWAYS the menu's first row reads Unsave GIVEN the post is kept

ALWAYS the post's card shows no saved mark anywhere

WHEN tap Save -> the post is kept AND the sheet closes AND the snackbar reads Saved.

WHEN tap Save GIVEN the save does not go through -> the save reverts AND the target's row says so with Retry

WHEN tap Unsave -> the sheet closes AND postDetail.snackbar reads Removed from Saved. with Undo on postDetail.snackbar.action

WHEN tap Hide with the author's handle GIVEN the menu was opened from the post being read -> the sheet closes AND the reader stays on the post being read AND the snackbar reads @ada is hidden. with Undo AND NEVER a confirm step appears

WHEN tap Hide with the author's handle GIVEN the hide does not go through -> the hide reverts AND the target's row says so with Retry

ALWAYS the hide row reads Unhide with the author's handle GIVEN the author is already hidden, wherever their post still stands — the post reached by a link or a search, Saved, the tag's page, and History until its next load — and keeps its one name whatever it reads

WHEN tap Unhide with the author's handle -> the sheet closes AND the reader stays where the menu was opened AND the author is unhidden AND the snackbar reads @ada is unhidden. with Undo AND NEVER a confirm step appears

WHEN tap Unhide with the author's handle GIVEN the unhide does not go through -> the unhide reverts AND the target's row says That didn't go through. with Retry

WHEN tap Cite in a new post -> the post wizard opens fresh at its first stage AND the post rides along unseen until the details stage

WHEN tap Cite in a new post GIVEN the reader is an applicant -> the menu closes AND the snackbar reads You can post once you're in. AND NEVER the wizard opens

WHEN tap postDetail.menuSheet.citedBy -> the menu closes AND what cites the post comes up in its Cited by sheet over the surface the menu was opened from

WHEN tap Opinions on this -> the menu closes AND the post's opinions sheet comes up over the surface the menu was opened from

ALWAYS Opinions on this and postDetail.menuSheet.citedBy stand in the post's menu whatever their counts, on every card and host, the post live or removed

ALWAYS the post detail's count lines keep their own rule beside the two rows, absent at zero and on a removed post

WHEN tap License terms -> the menu closes AND the post's terms come up in a sheet over the surface the menu was opened from

WHEN tap postDetail.menuSheet.report -> the menu closes AND postDetail.reportSheet rises over the surface the menu was opened from, its postDetail.reportSheet.title reading Report this post? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
