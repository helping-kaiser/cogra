# YourKey · `spec:design:behavior-your-key`

WHEN tap the Your key row in settings GIVEN Android and a key exists on this device and the phone holds a biometric or a screen lock -> the phone's own unlock is asked first AND YourKey opens once it passes

WHEN the phone's own unlock is cancelled -> the settings page stays AND NEVER the key is shown

WHEN tap the Your key row in settings GIVEN a browser that still keeps the seed -> YourKey opens AND NEVER a proof is asked for

WHEN tap the Your key row in settings GIVEN a browser whose seed is sealed behind its backup -> YourKeyGate opens before anything is shown

ALWAYS the account password never opens the export

ALWAYS the export shows the actor key in two encodings, PEM (PKCS#8) and Raw hex — Ed25519 private key, each under its own label

ALWAYS nothing on the screen is sent anywhere, and the key never crosses the wire

ALWAYS the web re-persists nothing when it shows a key opened from its backup

WHEN press Copy the PEM block -> the PEM block lands on the clipboard AND the snackbar reads Copied

WHEN press Copy the raw hex -> the raw hex lands on the clipboard AND the snackbar reads Copied

WHEN press either copy GIVEN Android -> the clip is flagged sensitive AND the system's own clip confirmation masks the key

ALWAYS the window keeps FLAG_SECURE GIVEN Android, so neither a screenshot nor the recents thumbnail shows the key

ALWAYS the warning is the body, said once, and no error colour stands near it

ALWAYS the header's arrow reads Back to settings

WHEN press the header's back arrow -> Settings opens

ALWAYS the paragraph says the key lives only in this browser on the web and only in this app in the app

ALWAYS the quiet note says the key is read from this browser on the web and from this app in the app

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach
