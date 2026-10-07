# SettingsHidden · `spec:design:behavior-settings-hidden`

WHEN tap Hidden accounts GIVEN at least one account is hidden -> the hidden-accounts sheet opens over settings, titled Hidden accounts AND settings stays beneath the scrim, inert AND focus moves to its title

ALWAYS the sheet's title carries no count

ALWAYS the sheet stands no taller than 88% of the screen's height

ALWAYS the sheet holds one row per hidden account, each with the person's name, their handle, Hidden with the age or date of the hiding, and Unhide on its trailing edge

ALWAYS a deleted account's row wears the reserved disc and reads Deleted account in the system's voice, with no handle and no settings.hiddenSheet.list.account.aside

ALWAYS the rows stand most recently hidden first

ALWAYS a hidden account's row is inert apart from its Unhide

WHEN tap a hidden account's row outside Unhide -> NEVER the profile opens

WHEN tap Unhide GIVEN another hidden account stays in the sheet -> that account's row goes AND their posts return to the reader's feed AND the snackbar reads the handle, then is unhidden — their posts can reach your feed again., as @juno is unhidden — their posts can reach your feed again., with Undo AND focus moves to the next row, else the previous AND NEVER a dialog asks

WHEN tap Unhide GIVEN the account was deleted -> its row goes AND the snackbar reads This account is unhidden — its posts can reach your feed again. with Undo AND NEVER a dialog asks

WHEN tap Unhide GIVEN it is the last hidden account -> the sheet closes onto settings AND the Hidden accounts row reads None AND focus lands on the Hidden accounts row AND the same snackbar answers with Undo AND NEVER an empty sheet stands

WHEN tap Undo on the unhide's snackbar -> the account is hidden again AND its posts leave the reader's feed again AND NEVER a dialog asks

WHEN tap Undo on the unhide's snackbar GIVEN the hide does not go through -> the account's row re-enters the sheet in its place AND settings.hiddenSheet.list.account.second reads That didn't go through. AND Retry stands in settings.hiddenSheet.list.account.trailing

WHEN tap Undo on the unhide's snackbar GIVEN the hide does not go through and the sheet had closed -> the Hidden accounts row carries That didn't go through. with Retry

WHEN tap Retry on a row whose Undo did not go through -> the hide is asked again

ALWAYS a row's failure line stands until Retry or the next fresh load

WHEN an unhide does not go through -> the unhide reverts AND the account's row comes back AND settings.hiddenSheet.list.account.second reads That didn't go through. AND Retry takes Unhide's place in settings.hiddenSheet.list.account.trailing

WHEN tap Retry on a row whose unhide did not go through -> the unhide tries again

ALWAYS hiding and unhiding change nothing for the hidden person

WHEN tap the scrim -> the sheet closes onto settings AND focus returns to the Hidden accounts row

WHEN swipe the sheet down, press system Back or press Escape -> the sheet closes onto settings AND focus returns to the Hidden accounts row
