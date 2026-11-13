# FeedRemovedMenu · `spec:design:behavior-feed-removed-menu`

WHEN tap the ⋮ of a removed post's card GIVEN the post is another's -> feed.menuSheet rises over the feed AND the feed stands unchanged beneath its wash

ALWAYS feed.menuSheet reads Save or Unsave, then Cite in a new post, then Hide with the author's handle, then feed.menuSheet.report at the sheet tail, the reader's card menu whole GIVEN the post was removed, by its author or by a passed proposal

ALWAYS a removed post's menu carries no License terms row, the license having gone with the payload

ALWAYS the rows read the same whichever removed the post, its author or a passed proposal

WHEN tap feed.menuSheet.save -> the removed post is kept as any post is kept AND the sheet closes

WHEN tap feed.menuSheet.cite -> the post wizard opens fresh at its first stage AND the removed post rides along unseen until the details stage

WHEN tap feed.menuSheet.hide -> the sheet closes AND the author is hidden as from any post of theirs AND that person's rows leave the feed AND NEVER a confirm step appears

WHEN tap feed.menuSheet.report -> the menu closes AND feed.reportSheet rises over the feed, feed.reportSheet.title reading Report this post? AND NEVER anything is sent yet

WHEN a guest taps any row of a post's menu, on any host -> the guest gate opens, the profile menu's rule

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
