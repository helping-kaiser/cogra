# SettingsUnhidden · `spec:design:behavior-settings-unhidden`

WHEN tap Unhide GIVEN another hidden account stays in the sheet -> that account's row leaves the sheet AND the rows behind it move up AND settings.snackbar reads @juno is unhidden — their posts can reach your feed again. with Undo AND NEVER a dialog asks

ALWAYS nothing marks the space an unhidden account's row left in the sheet

ALWAYS settings.snackbar stands above settings.hiddenSheet and its scrim, at the screen's foot GIVEN the sheet is open

ALWAYS settings.people.hidden counts the accounts still hidden

WHEN tap Undo on settings.snackbar -> the account is hidden again AND its posts leave the reader's feed again AND NEVER a dialog asks

WHEN tap Undo on settings.snackbar GIVEN the re-hide does not go through -> the account stays unhidden AND its settings.hiddenSheet.list.account row comes back into its place, the line That didn't go through. in settings.hiddenSheet.list.account.second and Retry in the trailing slot, until Retry or the next fresh load

WHEN tap Retry on the returned settings.hiddenSheet.list.account row -> the hide is asked again
