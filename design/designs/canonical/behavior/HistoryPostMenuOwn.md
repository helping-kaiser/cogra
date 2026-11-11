# HistoryPostMenuOwn · `spec:design:behavior-history-post-menu-own`

WHEN tap the ⋮ on a post card of the reader's own in History -> history.menuSheet rises over History AND History stands unchanged beneath its wash

ALWAYS history.menuSheet reads Save or Unsave, then Cite in a new post, then Edit, then Mark as sensitive, then Remove, then License terms, the own post menu's rows, and carries no Hide and no Report row

WHEN tap history.menuSheet.edit -> the post's edit opens

WHEN tap history.menuSheet.markSensitive -> the post's edit opens AND NEVER the post is marked without the edit's signing

WHEN tap history.menuSheet.remove -> the menu closes AND the think-twice dialog comes up over History

WHEN tap history.menuSheet.license -> the menu closes AND the post's terms come up in a sheet over History

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
