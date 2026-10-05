# SettingsDeleting · `spec:design:behavior-settings-deleting`

ALWAYS the deletion band stands under the settings header GIVEN the account's confirmed deletion is in its grace period

ALWAYS the Delete account row reads Deletion in and the days left, counting down GIVEN the account's confirmed deletion is in its grace period

ALWAYS the delete-account group carries no footnote GIVEN the account's confirmed deletion is in its grace period

ALWAYS every other row of settings stands and answers as it does outside the grace period

WHEN tap the Delete account row GIVEN the account's confirmed deletion is in its grace period -> the grace page opens with the deadline in full and Cancel AND NEVER the deletion's request screen opens

WHEN tap Cancel on the deletion band -> the deletion is called off AND the deletion band goes AND the Delete account row reads Delete account again AND the group's footnote returns AND the snackbar reads Canceled — your account stays, and nothing was deleted. AND NEVER the snackbar offers Undo AND NEVER a dialog asks

WHEN tap Cancel on the deletion band GIVEN the reader is offline -> the network error answers AND the deletion band stays AND the deletion still stands
