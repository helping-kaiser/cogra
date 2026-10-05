# ProfileDeletedMenu · `spec:design:behavior-profile-deleted-menu`

ALWAYS a deleted account's profile menu reads Save or Unsave, then Share this profile, then Hide this account

WHEN the deleted account's menu opens -> it reads Save or Unsave, Share this profile and Hide this account AND NEVER a Mention row stands AND NEVER a disabled row stands in its place AND NEVER a row names a handle

ALWAYS the hide row reads Hide this account, the same words every card the account authored shows, and never names a handle

ALWAYS every row stands at full strength

ALWAYS the deleted account's page stays open beneath the sheet, and nothing beneath the scrim takes a tap

WHEN tap Save -> the account is kept in the one Saved list beside posts and comments AND the sheet closes AND the snackbar reads Saved.

WHEN tap Save GIVEN the save does not go through -> the save reverts AND the target's row says That didn't go through. with Retry

WHEN tap Share this profile -> the platform's own share sheet opens

WHEN tap Hide this account -> the sheet closes AND the reader stays on the page AND the account's posts leave the reader's feed AND a snackbar offers Undo AND NEVER a confirm step appears

WHEN tap Hide this account GIVEN the hide does not go through -> the hide reverts AND the target's row says That didn't go through. with Retry

WHEN a guest taps Save or Hide this account -> the guest gate opens

WHEN tap the scrim, swipe the sheet down, press Back or press Escape -> the sheet closes AND nothing changes

WHEN the sheet closes -> focus returns to the ⋮ that opened it
