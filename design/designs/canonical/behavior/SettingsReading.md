# SettingsReading · `spec:design:behavior-settings-reading`

WHEN tap What your feed shows -> the filter sheet opens over settings, titled What your feed shows AND settings stays beneath the scrim, inert

ALWAYS the sheet is the feed's own filter sheet, its sections and hints the feed's

ALWAYS the sheet stands at 88% of the screen's height, its foot pinned and its sections scrolling above it

ALWAYS the sheet's foot holds Reset in its corner and Done at its end, and carries no reading of the staged filter

ALWAYS the sheet's "?" stands on the title's row and is named How the filter works

WHEN the sheet opens -> it shows the reader's own default, or CoGra's where the reader has set none AND focus moves to its title

WHEN tap a kind, form or also-show chip -> the chip's change is staged AND NEVER the default changes before Done

WHEN tap Ranked or Newest -> that order is staged as the default AND NEVER the default changes before Done

WHEN tap the already-seen toggle -> the toggle flips, staged AND NEVER the default changes before Done

WHEN tap Reset -> CoGra's own default is staged AND NEVER the reader's own default is staged AND NEVER the default changes before Done

WHEN press Done -> the sheet closes AND the staged filter is saved as the reader's own default AND the What your feed shows row reads it back in the filter pill's words AND focus returns to the row

ALWAYS every feed opens with the reader's saved default

ALWAYS search's order and its already-seen toggle follow the reader's saved default, and search's kinds stay search's own

ALWAYS the reader's saved default stays on this device

WHEN tap the scrim -> the sheet closes AND the default is what it was AND NEVER anything staged applies

WHEN swipe the sheet down, press system Back or press Escape -> the sheet closes AND the default is what it was AND NEVER anything staged applies

ALWAYS CoGra's own default order reads Newest GIVEN the ranker has not shipped
