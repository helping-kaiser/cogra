# JoinErrors · `spec:design:behavior-join-errors`

ALWAYS the board is a composite demonstration, never one reachable moment: it draws the server's answer and the two local refusals at once only to show each field's error state (seam 316)

WHEN press Create account GIVEN the password is shorter than 12 characters and Repeat password differs from it -> the Password field's line reads A password is at least 12 characters. AND the Repeat password field's line reads The two passwords don't match. AND NEVER the registration is sent AND NEVER the Email field changes

WHEN press Create account GIVEN every local check passes and the handle is taken -> the Handle field's line reads That handle is taken. AND NEVER the Email field changes

ALWAYS That handle is taken. never stands together with a local refusal: a local refusal stops the press before anything is sent

WHEN press Create account GIVEN a line the server answered stands -> that line goes AND only the new press's answers stand

ALWAYS each field is checked on its own at the press, so Repeat password's mismatch line stands beside Password's own line

ALWAYS each errored field takes M3's error state, its outline and its label in the error colour, with its line in place of its hint

ALWAYS an unerrored field keeps its own hint, and an errored one shows its line alone

ALWAYS the fields keep what was typed through the refusal

WHEN typing in the Password field GIVEN it carries its error line -> the field re-checks the length as the text changes AND the line goes once the password reaches 12 characters AND the hint At least 12 characters. returns

WHEN typing in Password or Repeat password GIVEN Repeat password carries The two passwords don't match. -> the line re-checks as the text changes AND it goes once the two passwords match AND NEVER a hint takes its place

WHEN typing in the Handle field GIVEN it carries That handle is taken. -> the line stands AND NEVER it goes before the next press of Create account

WHEN typing in a field that carries no error line -> NEVER the field turns to its error state before the next press of Create account

ALWAYS the heading names the inviter by the whole display name, else by the handle with its @, and wraps as running text, the name one unit that never stands on two lines, whole on a line or cut at its end with … when longer than the line

ALWAYS the header's arrow reads a plain Back, with no origin noun

WHEN press the header's back arrow GIVEN the link was pasted at the invite door -> InviteEntry opens

WHEN press the header's back arrow GIVEN the link was held from the arrival -> the borrowed view it was opened from comes back

WHEN press the header's back arrow GIVEN the form opened over the signed-in state -> the layer closes onto the signed-in state, untouched

WHEN press a password field's reveal control GIVEN its password is hidden -> that field's password shows AND its control is named Hide password

WHEN press a password field's reveal control GIVEN its password shows -> that field's password hides AND its control is named Show password

WHEN press Create account -> Create account refuses a second press until the registration answers AND NEVER Create account dims

WHEN the registration has not answered 200ms after the press -> Create account reads Creating account… AND NEVER a spinner appears

ALWAYS the screen's ways out refuse a press, undimmed and unchanged in face, from 200ms after the press of Create account until its answer comes — an entry form keeps its exits held while it submits, the named exception to Close (jakob 2026-11-11)

WHEN the account is created -> the applicant days begin on ApplicantFeed

WHEN the account is created GIVEN the form opened over the signed-in state -> the new account's applicant days begin on ApplicantFeed AND this device switches to the new account AND the other account's sessions stay valid wherever they are

WHEN press Create account GIVEN a field still fails -> its line updates in place AND NEVER the screen changes

WHEN press Create account GIVEN no answer reaches the device -> the fields keep what was typed AND the line That didn't send. Try again. stands first under the fields, above the Terms line, which stands directly above Create account AND Create account stays, the retry

ALWAYS the header's "?" is the screen's one explanation, named About CoGra, as on Join

WHEN tap the header's "?" -> About opens with a plain Back on its arrow

WHEN tap Already have an account? Sign in -> SignIn opens

ALWAYS a line the server answered stands until the next press of Create account, and only a field's local format line re-checks as the text changes

WHEN no answer has come 5s after the press of Create account -> Create account still reads Creating account… AND NEVER a slow line or a progress indicator appears

ALWAYS the header's arrow, the "?" and Already have an account? Sign in refuse a press, never dimmed, while Create account waits on its answer

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach

ALWAYS the line By creating your account you accept the Terms. stands directly above Create account, with Terms a door

ALWAYS the notice How CoGra handles your data: the Privacy Policy. stands at the form's foot, its own line with Privacy Policy a door, and never inside the accept sentence

ALWAYS Create account stands disabled with no line above it and its spoken description reads Waiting for a handle, your email and a password GIVEN Handle, Email, Password or Repeat password is empty

WHEN all four fields hold a character -> Create account wakes AND its spoken description Waiting for a handle, your email and a password goes
