# FeedRemovedMenuOwn · `spec:design:behavior-feed-removed-menu-own`

WHEN tap feed.card.menu GIVEN the card is the reader's own removed post -> feed.menuSheet rises over the feed AND the feed stands unchanged beneath its wash

ALWAYS feed.menuSheet reads Save or Unsave, then Cite in a new post, then License terms, your own post's menu less Edit, Mark as sensitive and Remove

WHEN tap feed.menuSheet.license -> the menu closes AND the terms the post was published under come up over the feed, as any post's do

WHEN tap feed.menuSheet.save -> the removed post is kept as any post is kept AND the sheet closes

WHEN tap feed.menuSheet.cite -> the post wizard opens fresh at its first stage AND the removed post rides along unseen until the details stage

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes