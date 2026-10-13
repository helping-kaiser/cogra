# ProfileOwnMenu · `spec:design:behavior-profile-own-menu`

ALWAYS the reader's own profile menu reads Saved, then History, then Share your profile

ALWAYS the menu carries no Report row, the own menus' rule

ALWAYS the reader's own profile stays open beneath the sheet, and nothing beneath the scrim takes a tap

WHEN tap Saved GIVEN the reader has kept something -> Saved opens

WHEN tap Saved GIVEN the reader has kept nothing -> Saved opens on its empty state

WHEN tap History GIVEN the reader has seen anything -> History opens

WHEN tap History GIVEN the reader has seen nothing yet -> History opens on its empty state

WHEN tap Share your profile -> the platform's own share sheet opens

WHEN tap the scrim, swipe the sheet down, press Back or press Escape -> the sheet closes AND nothing changes

WHEN the sheet closes -> focus returns to the ⋮ that opened it
