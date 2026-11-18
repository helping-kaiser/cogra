# ProfileDeletedPostMenu · `spec:design:behavior-profile-deleted-post-menu`

WHEN tap the ⋮ on profile.posts.card GIVEN the profile is a deleted account's and the deletion took the identity alone -> profile.menuSheet rises over the page AND the page stands unchanged beneath its wash

ALWAYS profile.menuSheet reads Save or Unsave, then Cite in a new post, then Hide this account, then profile.menuSheet.citedBy, then Opinions on this, then License terms, then profile.menuSheet.report at the sheet tail, the reader's post menu whole

ALWAYS the hide row reads Hide this account, the same words every card the account authored shows, and never names a handle

WHEN tap profile.menuSheet.hide -> the sheet closes AND the reader stays on the page AND the snackbar reads This account is hidden. with Undo AND NEVER a confirm step appears

WHEN tap profile.menuSheet.license -> the menu closes AND the post's terms come up in a sheet over the page

WHEN tap profile.menuSheet.report -> the menu closes AND the report confirm rises over the page, its title reading Report this post? AND NEVER anything is sent yet

WHEN a guest taps Save, Cite in a new post, Hide this account or Report -> the guest gate opens AND NEVER profile.menuSheet.citedBy, Opinions on this or License terms raise it

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
