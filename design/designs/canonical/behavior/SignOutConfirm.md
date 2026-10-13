# SignOutConfirm · `spec:design:behavior-sign-out-confirm`

WHEN tap Sign out GIVEN the don't-remember switch is on and this device holds the only copy of an unbacked key -> the dialog Sign out without a backup? opens over settings AND settings stays beneath the scrim, inert AND the reader is still signed in

ALWAYS the dialog names all three things the sign-out would clear: the key, the draft and any picks kept pending

ALWAYS the dialog's body reads This browser holds the only copy of your key. Signing out leaves your key, your draft and any opinions you kept pending here, locked until you sign in again. Erase them instead, and no one — including CoGra — can bring them back. on the web

ALWAYS the dialog's body reads This app holds the only copy of your key. Signing out leaves your key, your draft and any opinions you kept pending here, locked until you sign in again. Erase them instead, and no one — including CoGra — can bring them back. on android

ALWAYS Make a recovery code is the filled answer and leads, and Sign out, keep them locked and Erase them and sign out are the quiet ones

WHEN the dialog opens -> focus moves to its title AND focus stays inside the dialog until it closes

WHEN tap Make a recovery code -> the make-a-code screen opens AND the reader stays signed in AND NEVER anything is cleared

WHEN a recovery code has been made GIVEN the dialog was answered with Make a recovery code -> the next Sign out signs out without asking

WHEN tap Sign out, keep them locked -> the session ends AND the key, the draft and any picks kept pending stay on this device, sealed until this account signs in on this device again, online, with its current credentials AND the sign-in screen opens AND NEVER anything is erased

WHEN tap Erase them and sign out -> the session ends AND the key, the draft and any picks kept pending are erased from this device for good AND the sign-in screen opens

WHEN tap the scrim -> the dialog closes onto settings AND the reader is still signed in AND NEVER anything is erased AND focus returns to the Sign out row

WHEN press system Back GIVEN the dialog is open -> the dialog closes onto settings AND the reader is still signed in AND NEVER anything is erased

WHEN this device's session is ended from another device GIVEN the don't-remember switch is on and this device holds the only copy of an unbacked key -> the key and any picks kept pending stay on this device, sealed AND NEVER they are purged AND NEVER the dialog opens
