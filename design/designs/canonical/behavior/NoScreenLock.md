# NoScreenLock · `spec:design:behavior-no-screen-lock`

WHEN press Create a new recovery code, or Create my recovery code on the backup made late, GIVEN Android on a phone with neither a biometric nor a screen lock -> the dialog This phone has no screen lock opens over the settings screen AND NEVER the code is shown before the dialog is answered

WHEN tap the Your key row GIVEN Android on a phone with neither a biometric nor a screen lock -> the dialog This phone has no screen lock opens over the settings page AND NEVER the key is shown before the dialog is answered

ALWAYS the reader may go on past the warning, and the act is never refused for the missing lock

ALWAYS Cancel is the filled answer in the right-hand slot and Go on anyway the quiet text button

ALWAYS only the dialog and its scrim take a press while it is up

WHEN press Go on anyway GIVEN a recovery code is being made or replaced -> the recovery code screen opens with the code shown

WHEN press Go on anyway GIVEN the dialog rose from the Your key row -> the key export opens with the key shown

WHEN press Cancel -> the dialog closes AND nothing is shown or made

WHEN tap the scrim or press system Back -> the dialog closes AND nothing is shown or made
