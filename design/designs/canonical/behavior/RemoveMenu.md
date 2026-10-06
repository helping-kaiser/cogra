# RemoveMenu · `spec:design:behavior-remove-menu`

ALWAYS Save, or Unsave while the post is kept, is the menu's first row

ALWAYS License terms is the menu's last row

WHEN tap Save -> the sheet closes AND the snackbar confirms at once AND the row reads Unsave the next time the menu opens

WHEN Save does not go through -> the save reverts AND the post's row says so with Retry

WHEN tap Edit -> the post's edit opens

WHEN tap Mark as sensitive -> the post's edit opens AND NEVER the post is marked without the edit's signing

WHEN tap Remove -> the think-twice dialog opens

WHEN tap License terms -> the menu closes AND the post's terms come up in a sheet over the post

WHEN tap Cite in a new post -> the post wizard opens fresh at its first stage AND this post rides the draft unseen until the details stage

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
