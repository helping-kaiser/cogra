# SettingsHidden · `spec:design:behavior-settings-hidden`

WHEN tap Hidden accounts GIVEN at least one account is hidden -> the hidden-accounts sheet opens over settings, titled Hidden accounts AND settings stays beneath the scrim, inert AND focus moves to its title

ALWAYS the sheet's title carries no count

ALWAYS the sheet stands no taller than 88% of the screen's height

ALWAYS the sheet holds one row per hidden account, each with the person's name, their handle, Hidden with the age or date of the hiding, and Unhide on its trailing edge

ALWAYS the rows stand most recently hidden first

ALWAYS a hidden account's row is inert apart from its Unhide

WHEN tap a hidden account's row outside Unhide -> NEVER the profile opens

WHEN tap Unhide GIVEN another hidden account stays in the sheet -> that account's row goes AND their posts return to the reader's feed AND the snackbar reads the handle, then is unhidden — their posts can reach your feed again., as @juno is unhidden — their posts can reach your feed again., with Undo AND focus moves to the next row, else the previous AND NEVER a dialog asks

WHEN tap Unhide GIVEN it is the last hidden account -> the sheet closes onto settings AND the Hidden accounts row reads None AND focus lands on the Hidden accounts row AND the same snackbar answers with Undo AND NEVER an empty sheet stands

WHEN tap Undo on the unhide's snackbar -> the account is hidden again AND its posts leave the reader's feed again AND NEVER a dialog asks

WHEN an unhide does not go through -> the unhide reverts AND the account's row says That didn't go through. with Retry

WHEN tap Retry on a row whose unhide did not go through -> the unhide tries again

ALWAYS hiding and unhiding change nothing for the hidden person

WHEN tap the scrim -> the sheet closes onto settings AND focus returns to the Hidden accounts row

WHEN swipe the sheet down, press system Back or press Escape -> the sheet closes onto settings AND focus returns to the Hidden accounts row
