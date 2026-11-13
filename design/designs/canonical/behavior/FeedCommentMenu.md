# FeedCommentMenu · `spec:design:behavior-feed-comment-menu`

WHEN tap the ⋮ on feed.commentCard GIVEN the comment is someone else's -> feed.menuSheet rises over the feed, unstacked, AND the feed stands unchanged beneath its wash

ALWAYS feed.menuSheet reads Save or Unsave, then Cite in a new post, then feed.menuSheet.citedBy, then Opinions on this, then License terms, then feed.menuSheet.report at the sheet tail, the comment's menu's own rows

ALWAYS the comment's menu carries no Hide row

WHEN tap feed.menuSheet.opinions -> the menu closes AND the comment's opinions sheet comes up over the feed

WHEN tap feed.menuSheet.citedBy -> the menu closes AND what cites the comment comes up over the feed

WHEN tap feed.menuSheet.license -> the menu closes AND the comment's terms come up in a sheet over the feed

WHEN tap feed.menuSheet.report -> the menu closes AND the report confirm rises over the feed, its title reading Report this comment? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
