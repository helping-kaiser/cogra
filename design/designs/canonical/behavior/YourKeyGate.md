# YourKeyGate · `spec:design:behavior-your-key-gate`

WHEN tap the Your key row in settings GIVEN a browser whose seed is sealed behind its backup -> YourKeyGate opens AND NEVER the key is shown before the code opens the backup

ALWAYS the gate is the browser's alone: Android asks the phone's own unlock, and a browser that still keeps the seed asks nothing

ALWAYS the account password never opens the export

ALWAYS the field asks for the current recovery code and reads it the way every code input reads it: case, dashes and spaces never matter, and I, L and O read as 1, 1 and 0

WHEN typing in the field GIVEN it carries no line -> NEVER a line appears before the next press

WHEN press Show my key -> Show my key refuses a second press until the backup answers AND NEVER Show my key dims

WHEN the backup has not answered 200ms after the press -> Show my key reads Showing my key… AND NEVER a spinner appears

WHEN the code opens the backup -> YourKey opens with the key shown AND nothing is re-persisted

WHEN the code does not open the backup -> the field's line reads That code doesn't check out. AND the field takes the error state AND the field keeps what was typed AND NEVER the key is shown

WHEN press Show my key GIVEN no answer reaches the device -> the field keeps what was typed AND the line That didn't send. Try again. stands above Show my key AND Show my key stays, the retry

ALWAYS the header's arrow reads Back to settings

WHEN press the header's back arrow -> Settings opens AND nothing is shown
