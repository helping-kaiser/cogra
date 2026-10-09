# ProfileMenu · `spec:design:behavior-profile-menu`

ALWAYS another person's profile menu reads Save or Unsave, then Mention in a new post, then Share this profile, then Hide with the person's handle, then profile.menuSheet.report at the sheet tail

ALWAYS the menu's first row reads Unsave GIVEN the person is kept

ALWAYS the menu carries no License terms row and no Cite row

ALWAYS the profile stays open beneath the sheet, and nothing beneath the scrim takes a tap

WHEN tap Save -> the person is kept in the one Saved list beside posts and comments AND the sheet closes AND the snackbar reads Saved.

WHEN tap Save GIVEN the save does not go through -> the save reverts AND the target's row says That didn't go through. with Retry, the profile's actions row when the menu opened on the profile

WHEN tap Unsave -> the sheet closes AND profile.snackbar reads Removed from Saved. with Undo on profile.snackbar.action

WHEN tap Mention in a new post -> the post wizard opens fresh at its first stage AND the person rides along as a staged reference, unseen until the details stage

WHEN tap Mention in a new post GIVEN the reader is an applicant whose application is live and a post is already staged -> the menu closes AND the snackbar reads Your post waits with your application — it arrives with you. AND NEVER the wizard opens

WHEN tap Mention in a new post GIVEN the reader is an applicant whose application was closed and a post already waits -> the menu closes AND the snackbar reads Your post waits — it arrives when someone vouches you in. AND NEVER the wizard opens

WHEN tap Share this profile -> the platform's own share sheet opens

WHEN tap Hide with the person's handle -> the sheet closes AND the reader stays on the profile AND the snackbar reads @ada is hidden — their posts stay out of your feed. with Undo AND NEVER a confirm step appears

WHEN tap Hide with the person's handle GIVEN the hide does not go through -> the hide reverts AND the target's row says That didn't go through. with Retry, the profile's actions row when the menu opened on the profile

WHEN tap Hide with the person's handle GIVEN the menu was opened from a profile card in the feed -> the sheet closes AND that person's rows leave the feed AND the rows behind them move up AND the snackbar reads @ada is hidden — their posts stay out of your feed. with Undo

ALWAYS the menu carries no Share this profile row GIVEN it was opened from a profile card in the feed, whose own row carries the share

ALWAYS a hidden person's profile still opens

WHEN tap profile.menuSheet.report -> the sheet closes AND the report confirm sheet rises over the profile, its title reading Report @ada? AND NEVER anything is sent yet

WHEN a guest taps any row but Share this profile -> the guest gate opens

WHEN tap the scrim, swipe the sheet down, press Back or press Escape -> the sheet closes AND nothing changes

WHEN the sheet closes -> focus returns to the ⋮ that opened it
