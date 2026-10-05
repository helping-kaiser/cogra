# ResetNew · `spec:design:behavior-reset-new`

WHEN the reset mail's link is opened -> ResetNew opens AND NEVER a field asks for the link's own secret

ALWAYS the screen carries no header and no back arrow

ALWAYS the screen holds one password field and one commitment, Set the new password, and no confirm field

ALWAYS the field's hint reads At least 12 characters.

ALWAYS the quiet note says the reset restores the sign-in only, never the key, in Reset's own words

WHEN press the password's reveal control GIVEN the password is hidden -> the password shows AND the control is named Hide password

WHEN press the password's reveal control GIVEN the password shows -> the password hides AND the control is named Show password

WHEN press Set the new password -> Set the new password refuses a second press until the reset answers AND NEVER Set the new password dims

WHEN the reset has not answered 200ms after the press -> Set the new password reads Setting the new password… AND NEVER a spinner appears

WHEN the new password is taken -> every device is signed out, this one included AND SignIn opens

WHEN press Set the new password GIVEN the password is shorter than 12 characters -> the field's line reads A password is at least 12 characters. in place of the hint AND the field takes the error state

WHEN the new password is refused as one that turned up in a data breach -> the field's line reads That password has turned up in a data breach — pick another one. in place of the hint AND the field takes the error state

WHEN press Set the new password GIVEN no answer reaches the device -> the field keeps what was typed AND the line That didn't send. Try again. stands above Set the new password AND Set the new password stays, the retry

ALWAYS a line the server answered stands until the next press of Set the new password, and only a field's local format line re-checks as the text changes

WHEN no answer has come 5s after the press of Set the new password -> Set the new password still reads Setting the new password… AND NEVER a slow line or a progress indicator appears
