# FeedCommentMenuOwn · `spec:design:behavior-feed-comment-menu-own`

WHEN tap the ⋮ on feed.commentCard GIVEN the comment is the reader's own -> feed.menuSheet rises over the feed, unstacked, AND the feed stands unchanged beneath its wash

ALWAYS feed.menuSheet reads Save or Unsave, then Cite in a new post, then Edit, then Remove, then feed.menuSheet.citedBy, then Opinions on this, then License terms, the own comment menu's rows, and carries no Report row

WHEN tap feed.menuSheet.edit -> the menu closes AND the comment's edit opens over the feed

WHEN tap feed.menuSheet.remove -> the menu closes AND the think-twice dialog comes up over the feed

WHEN tap feed.menuSheet.opinions -> the menu closes AND the comment's opinions sheet comes up over the feed

WHEN tap feed.menuSheet.citedBy -> the menu closes AND what cites the comment comes up over the feed

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes

WHEN the comment's edit opened from feed.menuSheet.edit is signed -> the feed comes back as it was left AND the comment's card settles in place wearing Still settling AND NEVER the thread opens
