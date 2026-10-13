# SettingsDeleting · `spec:design:behavior-settings-deleting`

ALWAYS settings.deletionBand stands under the settings header GIVEN the account's confirmed deletion is in its grace period

ALWAYS the Delete account row reads Deletion in and the days left, counting down GIVEN the account's confirmed deletion is in its grace period

ALWAYS the days left round to the nearest whole day while 24 hours or more remain, then the row counts the hours left, rounded up

ALWAYS the delete-account group carries no footnote GIVEN the account's confirmed deletion is in its grace period

ALWAYS every other row of settings stands and answers as it does outside the grace period

WHEN tap the Delete account row GIVEN the account's confirmed deletion is in its grace period -> the grace page opens with the deadline in full and Cancel AND NEVER the deletion's request screen opens

WHEN tap Cancel on settings.deletionBand -> the deletion is called off AND settings.deletionBand goes AND the Delete account row reads Delete account again AND the group's footnote returns AND the snackbar reads Canceled — your account stays, and nothing was deleted. AND NEVER the snackbar offers Undo AND NEVER a dialog asks

WHEN tap Cancel on settings.deletionBand GIVEN the reader is offline -> the network error answers AND settings.deletionBand stays AND the deletion still stands
