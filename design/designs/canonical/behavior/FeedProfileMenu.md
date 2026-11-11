# FeedProfileMenu · `spec:design:behavior-feed-profile-menu`

WHEN tap the ⋮ on feed.profileCard -> feed.menuSheet rises over the feed AND the feed stands unchanged beneath its wash

ALWAYS feed.menuSheet reads Save or Unsave, then Mention in a new post, then Hide with the person's handle, then feed.menuSheet.report at the sheet tail, the profile menu's rows less Share this profile

ALWAYS the menu of feed.profileCard holds the same rows on every host the card stands on, the feed, History and Saved, Saved's first row reading Unsave

WHEN tap feed.menuSheet.mention -> the post wizard opens fresh at its first stage AND the person rides along as a staged reference, unseen until the details stage

WHEN tap feed.menuSheet.hide -> the sheet closes AND that person's rows leave the feed AND the rows behind them move up AND the snackbar reads @mira is hidden — their posts stay out of your feed. with Undo AND NEVER a confirm step appears

WHEN tap feed.menuSheet.report -> the sheet closes AND the report confirm sheet rises over the feed, its title reading Report @mira? AND NEVER anything is sent yet

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND nothing changes
