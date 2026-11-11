# ProfileCommentsMenuOwn · `spec:design:behavior-profile-comments-menu-own`

WHEN tap the ⋮ on a comment card on the reader's own Comments tab -> profile.menuSheet rises over the reader's own profile, unstacked, AND the profile stands unchanged beneath its wash

ALWAYS the own comment's menu on the own profile reads Save or Unsave, then Cite in a new post, then Remove, then profile.menuSheet.citedBy, then Opinions on this, then License terms, the own comment menu's rows, and carries no Report row

WHEN tap profile.menuSheet.remove -> the menu closes AND the think-twice dialog comes up over the profile

WHEN tap profile.menuSheet.opinions -> the menu closes AND the comment's opinions sheet comes up over the profile

WHEN tap profile.menuSheet.citedBy -> the menu closes AND what cites the comment comes up over the profile

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
