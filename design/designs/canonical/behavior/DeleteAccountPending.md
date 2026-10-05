# DeleteAccountPending · `spec:design:behavior-delete-account-pending`

WHEN tap the Delete account row GIVEN the account's confirmed deletion is in its grace period -> the grace page opens, titled Delete account, with the deadline in days and its date AND Cancel as its one commitment

ALWAYS the grace page says nothing has changed until the deadline and canceling keeps everything as it is

ALWAYS the deletion band does not stand on the grace page

WHEN press Cancel -> the deletion is called off AND settings returns with the deletion band gone AND the Delete account row reads Delete account AND the snackbar reads Canceled — your account stays, and nothing was deleted. AND NEVER the snackbar offers Undo AND NEVER a dialog asks

WHEN the cancel has not answered 200ms after the press -> Cancel reads Canceling… in its own place AND NEVER a spinner appears

WHEN press Cancel GIVEN the reader is offline -> the network error answers AND the deletion still stands

WHEN press the header back arrow -> settings returns under the deletion band AND the deletion still stands
