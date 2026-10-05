# KeyConfirm · `spec:design:behavior-key-confirm`

WHEN press Create my recovery code on the key ceremony -> the dialog Ready to record your code? opens over the ceremony AND NEVER the code is shown before the dialog is answered

ALWAYS only the dialog and its scrim take a press while it is up

ALWAYS Show my code is the filled answer and Cancel the quiet one

WHEN press Cancel -> the dialog closes onto the key ceremony AND nothing is made

WHEN tap the scrim or press system Back or Escape -> the dialog closes onto the key ceremony AND nothing is made

WHEN press Show my code -> the recovery code screen opens with the code shown AND the seed and the code are made and held in memory AND NEVER the key is attached, kept or backed up before the typed-back code confirms

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach
