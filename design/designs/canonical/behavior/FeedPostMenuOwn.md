# FeedPostMenuOwn · `spec:design:behavior-feed-post-menu-own`

WHEN tap the ⋮ on a feed card of the reader's own -> feed.menuSheet rises over the feed AND the feed stands unchanged beneath its wash

ALWAYS feed.menuSheet reads Save or Unsave, then Cite in a new post, then Edit, then Mark as sensitive, then Remove, then License terms, the own post menu's rows on the post detail, and carries no Hide and no Report row

ALWAYS the own menu off the post detail is the detail's own menu, on the feed, the own profile's Posts and Comments tabs and a comment card of the reader's own in the feed, a comment's menu holding the own comment menu's rows

ALWAYS feed.menuSheet.save reads Unsave GIVEN the post is kept

WHEN tap feed.menuSheet.save GIVEN the post is not kept -> the post is kept AND the sheet closes AND feed.snackbar reads Saved.

WHEN tap feed.menuSheet.save GIVEN the save does not go through -> the save reverts AND the target's row says so with Retry

WHEN tap feed.menuSheet.cite -> the post wizard opens fresh at its first stage AND the post rides along unseen until the details stage

WHEN tap feed.menuSheet.edit -> the post's edit opens

WHEN tap feed.menuSheet.markSensitive -> the post's edit opens AND NEVER the post is marked without the edit's signing

WHEN tap feed.menuSheet.remove -> the menu closes AND feed.dialog comes up over the feed

WHEN tap feed.menuSheet.license -> the menu closes AND the post's terms come up in feed.licenseSheet over the feed

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
