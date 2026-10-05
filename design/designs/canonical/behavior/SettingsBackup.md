# SettingsBackup · `spec:design:behavior-settings-backup`

ALWAYS the replace screen says before the act that the old code keeps working until the new one is confirmed

ALWAYS the replace screen keeps its back arrow, and nothing is lost by leaving it

ALWAYS the browser's replace screen carries the field Current recovery code and, under it, the line for a browser that lost its code

ALWAYS the Android replace screen carries no code field and no lost-code line

WHEN typing in Current recovery code -> NEVER the field is marked before the next press of Create a new recovery code

WHEN press Create a new recovery code in a browser GIVEN the current code checks out -> the code screen opens with the new code AND back is swallowed there until the code is typed back

WHEN press Create a new recovery code in a browser GIVEN the current code doesn't check out -> the field reads That code doesn't check out. AND NEVER a new code is made AND NEVER the old backup changes

WHEN press Create a new recovery code on Android GIVEN the phone has a screen lock -> the phone's own unlock is asked AND NEVER a new code is made before it answers

WHEN the phone's unlock prompt is cancelled GIVEN Create a new recovery code raised it -> the replace screen stays as it was AND NEVER a new code is made

WHEN press Create a new recovery code on Android GIVEN the phone has no screen lock -> the no-screen-lock warning opens before anything else

WHEN the replace has not answered 200ms after the press -> Create a new recovery code reads Creating a new recovery code… in its own place AND NEVER a spinner appears

WHEN press Create a new recovery code GIVEN the reader is offline -> the network error answers AND NEVER the old backup changes

WHEN the new code is typed back on the code screen -> the new backup uploads AND the old code stops working AND a notice of the replacement is mailed AND settings returns with the snackbar Your key is backed up with the new code.

WHEN the code screen is left before the new code is typed back -> the old backup stands exactly as it was AND the old code keeps working

WHEN press the header back arrow -> settings returns AND NEVER a code is made AND NEVER the old backup changes
