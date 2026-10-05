# SettingsBackupError · `spec:design:behavior-settings-backup-error`

ALWAYS the refused code reads That code doesn't check out. as the Current recovery code field's own line, in Restore's words

ALWAYS the lost-code line stays under the field GIVEN the field carries its error

WHEN typing in Current recovery code GIVEN the field carries its error -> the error line stays until the next press of Create a new recovery code

WHEN press Create a new recovery code GIVEN the code now checks out -> the error line goes AND the code screen opens with the new code AND back is swallowed there until the code is typed back

WHEN press Create a new recovery code GIVEN the code still doesn't check out -> the error line stands in place AND NEVER a new code is made AND NEVER the old backup changes

WHEN press Create a new recovery code GIVEN the reader is offline -> the network error answers AND NEVER the old backup changes

WHEN press the header back arrow -> settings returns AND NEVER a code is made AND NEVER the old backup changes

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach
