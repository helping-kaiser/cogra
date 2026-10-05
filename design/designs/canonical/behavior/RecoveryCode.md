# RecoveryCode · `spec:design:behavior-recovery-code`

WHEN press Show my code on the ceremony's ask -> RecoveryCode opens with the code shown

WHEN a recovery code is made late or replaced from settings and its proof is given -> RecoveryCode opens with the new code shown

ALWAYS the code is shown once and never stored

ALWAYS the header keeps its band and offers no way out

ALWAYS the typed-back confirmation is the screen's only exit

WHEN press Android Back -> the snackbar reads Type the code back to finish AND the screen stays AND NEVER the press is swallowed silently

ALWAYS screenshots of the screen stay possible, and the window never takes FLAG_SECURE

WHEN press Copy GIVEN the web -> the code lands on the clipboard AND the line Code copied stands under Copy

WHEN press Copy GIVEN the web and the browser refuses the copy -> the line This browser would not let the page copy. Select the code and copy it yourself. stands under Copy

WHEN press Copy GIVEN the app -> the code lands on the clipboard flagged sensitive AND the system's own masked clip confirmation answers AND NEVER the line Code copied appears

ALWAYS the confirm field reads what is typed or pasted the way every code input reads it: case, dashes and spaces never matter, and I, L and O read as 1, 1 and 0

ALWAYS I've written it down stays disabled until the typed text, read that way, is the code

ALWAYS the confirm field carries no line GIVEN it is empty or holds a correct beginning of the code

WHEN the typed text, read that way, stops being a beginning of the code -> the field's line reads That doesn't match the code above. at once AND the field takes the error state AND NEVER the line waits for a press

WHEN press I've written it down -> I've written it down refuses a second press until the answer comes AND NEVER I've written it down dims

WHEN press I've written it down GIVEN the code was made by the ceremony -> the key is attached, kept and its sealed backup uploaded, all at this moment AND the reader returns where the ceremony began AND the snackbar reads Key made and backed up.

WHEN press I've written it down GIVEN the code was made or replaced from settings -> the new backup uploads AND Settings opens AND the snackbar reads Your key is backed up with the new code.

WHEN press I've written it down GIVEN no answer reaches the device -> the code stays on screen until the backup uploads AND the line That didn't send. Try again. stands above I've written it down AND I've written it down stays, the retry

WHEN the tab is closed or the app is killed before the code confirms -> nothing this screen would make exists AND the next open shows what stood before the ceremony exactly as it was

ALWAYS the old code keeps working until the new one is confirmed GIVEN a code being replaced

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach

WHEN press the browser's back on the web -> the snackbar reads Type the code back to finish AND the screen stays, as Android Back answers AND NEVER the browser leaves the screen
