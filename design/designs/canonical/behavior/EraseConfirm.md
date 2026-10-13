# EraseConfirm · `spec:design:behavior-erase-confirm`

WHEN tap settings.clearing.erase -> settings.dialog opens over settings, its settings.dialog.title reading Erase everything from this browser? on the web and Erase everything from this app? on android AND settings stays beneath the scrim, inert AND the reader is still signed in AND NEVER anything is erased before an answer

ALWAYS settings.dialog.body reads This browser holds the only copy of your key, and it has no recovery code. Erase everything and your account is gone for good — no one, including CoGra, can bring it back. Your draft, any kept picks and the choices kept on this device go too, and you're signed out. on the web and This app holds the only copy of your key, and it has no recovery code. Erase everything and your account is gone for good — no one, including CoGra, can bring it back. Your draft, any kept picks and the choices kept on this device go too, and you're signed out. on android GIVEN no recovery code exists

ALWAYS settings.dialog.body reads Your key is erased with everything else, and only your recovery code can bring it back — without the code, your account is gone for good. Your draft, any kept picks and the choices kept on this device go too, and you're signed out. What you've seen comes back when you sign in. GIVEN a recovery code exists

ALWAYS settings.dialog.body names the key and the account gone for good before anything else that goes

ALWAYS settings.dialog.recovery reads Make a recovery code, filled and leading, and settings.dialog.erase reads Erase everything and sign out as the quiet answer GIVEN no recovery code exists

ALWAYS settings.dialog.erase reads Erase everything and sign out, quiet on the left, and settings.dialog.cancel reads Cancel, filled on the right GIVEN a recovery code exists

ALWAYS settings.dialog.erase takes no error colour

WHEN the dialog opens -> focus moves to settings.dialog.title AND focus stays inside the dialog until it closes

WHEN tap settings.dialog.recovery -> the make-a-code screen opens AND the reader stays signed in AND NEVER anything is erased

WHEN tap settings.dialog.erase -> the key, the draft, any picks kept pending, the choices kept on this device and the seen list's copy on this device are erased for good AND the session ends AND the sign-in screen opens with no account offered AND NEVER a snackbar answers

WHEN tap settings.dialog.cancel -> the dialog closes onto settings AND the reader is still signed in AND NEVER anything is erased AND focus returns to settings.clearing.erase

WHEN tap the scrim -> the dialog closes onto settings AND the reader is still signed in AND NEVER anything is erased AND focus returns to settings.clearing.erase

WHEN press system Back GIVEN the dialog is open -> the dialog closes onto settings AND the reader is still signed in AND NEVER anything is erased

WHEN the reader signs in again after an erase -> what they've seen comes back from the server AND NEVER the key comes back without the recovery code
