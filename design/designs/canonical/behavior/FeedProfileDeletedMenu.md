# FeedProfileDeletedMenu · `spec:design:behavior-feed-profile-deleted-menu`

WHEN tap the ⋮ on feed.profileCard GIVEN the account was deleted -> feed.menuSheet rises over the feed AND the feed stands unchanged beneath its wash

ALWAYS feed.menuSheet reads Save or Unsave, then Hide this account, then feed.menuSheet.report at the sheet tail, the deleted account's profile menu less Share this profile

WHEN the deleted account's card menu opens -> NEVER a Mention row stands AND NEVER a disabled row stands in its place AND NEVER a row names a handle

WHEN tap feed.menuSheet.hide -> the sheet closes AND the account's rows leave the feed AND the rows behind them move up AND the snackbar reads This account is hidden. with Undo AND NEVER a confirm step appears

WHEN tap feed.menuSheet.report -> the sheet closes AND the report confirm sheet rises over the feed, its title reading Report this account? AND NEVER anything is sent yet AND NEVER its title names a handle

WHEN a guest taps Save, Hide this account or feed.menuSheet.report -> the guest gate opens

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
