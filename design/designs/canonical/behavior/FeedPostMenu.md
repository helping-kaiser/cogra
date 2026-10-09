# FeedPostMenu · `spec:design:behavior-feed-post-menu`

WHEN tap a feed card's ⋮ -> feed.menuSheet rises over the feed AND the feed stands unchanged beneath its wash

ALWAYS feed.menuSheet reads Save or Unsave, then Cite in a new post, then Hide with the author's handle, then License terms, then feed.menuSheet.report at the sheet tail, the reader's post menu's own rows

ALWAYS feed.menuSheet.save reads Save GIVEN the post is not kept

ALWAYS feed.menuSheet.save reads Unsave GIVEN the post is kept

WHEN tap feed.menuSheet.save GIVEN the post is not kept -> the post is kept AND the sheet closes AND feed.snackbar reads Saved.

WHEN tap feed.menuSheet.save GIVEN the save does not go through -> the save reverts AND the target's row says so with Retry

WHEN tap feed.menuSheet.save GIVEN the post is kept -> the sheet closes AND feed.snackbar reads Removed from Saved. with Undo on feed.snackbar.action

WHEN tap feed.menuSheet.cite -> the post wizard opens fresh at its first stage AND the post rides along unseen until the details stage

WHEN tap feed.menuSheet.hide -> the sheet closes AND that person's rows leave the feed AND the rows behind them move up AND feed.snackbar reads @ada is hidden — their posts stay out of your feed. with Undo AND NEVER a confirm step appears

WHEN tap feed.menuSheet.license -> the menu closes AND the post's terms come up in a sheet over the feed

WHEN tap feed.menuSheet.report -> the menu closes AND the report confirm sheet rises over the feed, its title reading Report this post? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
