# JoinErrors · `spec:design:behavior-join-errors`

WHEN press Create account GIVEN the handle is taken and the password is shorter than 12 characters -> the Handle field's line reads That handle is taken. AND the Password field's line reads A password is at least 12 characters. AND NEVER the Email field changes

ALWAYS each errored field takes M3's error state, its outline and its label in the error colour, with its line in place of its hint

ALWAYS an unerrored field keeps its own hint, and an errored one shows its line alone

ALWAYS the fields keep what was typed through the refusal

WHEN typing in the Password field GIVEN it carries its error line -> the field re-checks the length as the text changes AND the line goes once the password reaches 12 characters AND the hint At least 12 characters. returns

WHEN typing in the Handle field GIVEN it carries That handle is taken. -> the line stands AND NEVER it goes before the next press of Create account

WHEN typing in a field that carries no error line -> NEVER the field turns to its error state before the next press of Create account

ALWAYS the header's arrow reads a plain Back, with no origin noun

WHEN press the header's back arrow GIVEN the link was pasted at the invite door -> InviteEntry opens

WHEN press the header's back arrow GIVEN the link was held from the arrival -> the borrowed view it was opened from comes back

WHEN press the header's back arrow GIVEN the form opened over the signed-in state -> the layer closes onto the signed-in state, untouched

WHEN press the password's reveal control GIVEN the password is hidden -> the password shows AND the control is named Hide password

WHEN press the password's reveal control GIVEN the password shows -> the password hides AND the control is named Show password

WHEN press Create account -> Create account refuses a second press until the registration answers AND NEVER Create account dims

WHEN the registration has not answered 200ms after the press -> Create account reads Creating account… AND NEVER a spinner appears

WHEN the account is created -> the applicant days begin on ApplicantFeed

WHEN the account is created GIVEN the form opened over the signed-in state -> the new account's applicant days begin on ApplicantFeed AND this device switches to the new account AND the other account's sessions stay valid wherever they are

WHEN press Create account GIVEN a field still fails -> its line updates in place AND NEVER the screen changes

WHEN press Create account GIVEN no answer reaches the device -> the fields keep what was typed AND the line That didn't send. Try again. stands above Create account AND Create account stays, the retry

WHEN tap Already have an account? Sign in -> SignIn opens

ALWAYS a line the server answered stands until the next press of Create account, and only a field's local format line re-checks as the text changes

WHEN no answer has come 5s after the press of Create account -> Create account still reads Creating account… AND NEVER a slow line or a progress indicator appears

ALWAYS the header's arrow and Already have an account? Sign in refuse a press, never dimmed, while Create account waits on its answer

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach

ALWAYS the line By creating your account you accept the Terms. stands directly above Create account, with Terms a door

ALWAYS the notice How CoGra handles your data: the Privacy Policy. stands at the form's foot, its own line with Privacy Policy a door, and never inside the accept sentence

ALWAYS Create account stands disabled with Waiting for a handle, your email and a password right above it GIVEN Handle, Email or Password is empty

WHEN all three fields hold a character -> Create account wakes AND the line Waiting for a handle, your email and a password goes
