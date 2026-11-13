# ResetNew · `spec:design:behavior-reset-new`

WHEN the reset mail's link is opened GIVEN the link is live -> ResetNew opens AND NEVER a field asks for the link's own secret

WHEN the reset mail's link is opened -> the link is checked before the form stands AND nothing stands on the screen for the first 200ms AND NEVER the form stands before the check answers

WHEN the check has not answered 200ms after the link opened -> reset.loading reads Loading… at the column's head AND NEVER a spinner appears

WHEN the check gets no answer -> reset.fault reads Can't reach the server — this page can't load right now. over reset.fault.retry, outlined and reading Retry, in the form's place AND NEVER the form stands

WHEN the check is refused by its budget -> reset.fault reads Too many tries. Wait a little, then try again. over the same reset.fault.retry AND NEVER the form stands

WHEN tap reset.fault.retry -> the same link is checked again AND the screen answers as the check does, the form when the link is live and ResetExpired when it is spent

ALWAYS the screen carries no header and no back arrow

ALWAYS the screen holds two password fields, New password and under it Repeat password, masked alike, each with its own reveal control, and one commitment, Set the new password

ALWAYS New password's hint reads At least 12 characters. GIVEN the field carries no error line

ALWAYS Repeat password carries no hint, only its error line when it is refused

ALWAYS the quiet note says the reset restores the sign-in only, never the key, in Reset's own words

WHEN press a password field's reveal control GIVEN its password is hidden -> that field's password shows AND its control is named Hide password

WHEN press a password field's reveal control GIVEN its password shows -> that field's password hides AND its control is named Show password

WHEN press Set the new password -> Set the new password refuses a second press until the reset answers AND NEVER Set the new password dims

WHEN the reset has not answered 200ms after the press -> Set the new password reads Setting the new password… AND NEVER a spinner appears

WHEN the new password is taken -> every device is signed out, this one included AND SignIn opens

WHEN press Set the new password GIVEN the password is shorter than 12 characters -> New password's line reads A password is at least 12 characters. in place of the hint AND the field takes the error state

WHEN press Set the new password GIVEN Repeat password differs from New password -> Repeat password's line reads The two passwords don't match. AND the field takes the error state AND NEVER the password changes

WHEN typing in New password or Repeat password GIVEN Repeat password carries The two passwords don't match. -> the line re-checks as the text changes AND it goes once the two passwords match

WHEN the new password is refused as one that turned up in a data breach -> New password's line reads That password has turned up in a data breach — pick another one. in place of the hint AND the field takes the error state

WHEN press Set the new password GIVEN no answer reaches the device -> the fields keep what was typed AND the line That didn't send. Try again. stands above Set the new password AND Set the new password stays, the retry

ALWAYS a line the server answered stands until the next press of Set the new password, and only a field's local format line re-checks as the text changes

WHEN no answer has come 5s after the press of Set the new password -> Set the new password still reads Setting the new password… AND NEVER a slow line or a progress indicator appears

WHEN press Set the new password GIVEN the password is longer than 128 characters -> New password's line reads A password is at most 128 characters. in place of the hint AND the field takes the error state

WHEN press Set the new password GIVEN the link was spent or went past its time while the form stood open -> ResetExpired opens AND NEVER the password changes

WHEN a reset link already used or past its time is opened -> ResetExpired opens AND NEVER ResetNew opens

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach

WHEN press system Back -> the platform leaves to wherever the mail link was opened from AND NEVER a CoGra screen opens in its place

ALWAYS Set the new password stands disabled with no line above it and its spoken description reads Waiting for a new password GIVEN New password or Repeat password is empty

WHEN both password fields hold a character -> Set the new password wakes AND its spoken description Waiting for a new password goes
