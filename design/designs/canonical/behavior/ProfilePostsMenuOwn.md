# ProfilePostsMenuOwn · `spec:design:behavior-profile-posts-menu-own`

WHEN tap the ⋮ on profile.posts.card GIVEN the profile is the reader's own and profile.tabRow.postsTab is lit -> profile.menuSheet rises over the reader's own profile AND the profile stands unchanged beneath its wash

ALWAYS the own post's menu on the own profile reads Save or Unsave, then Cite in a new post, then Edit, then Mark as sensitive, then Remove, then License terms, the own post menu's rows, and carries no Hide and no Report row

WHEN tap profile.menuSheet.edit -> the post's edit opens

WHEN tap profile.menuSheet.markSensitive -> the post's edit opens AND NEVER the post is marked without the edit's signing

WHEN tap profile.menuSheet.remove -> the menu closes AND the think-twice dialog comes up over the profile

WHEN tap profile.menuSheet.license -> the menu closes AND the post's terms come up in a sheet over the profile

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
