# Join · `spec:design:behavior-join`

WHEN a live invite link checks out at the invite door -> Join opens holding the link

WHEN press Sign in or join, the band's or a guest gate's, GIVEN a live invite link is held -> Join opens holding the link AND NEVER the invite door is shown

WHEN a live invite link is opened GIVEN the reader is signed in -> Join opens holding the link as a layer over the signed-in state

ALWAYS the face and the name over the form are the link's inviter's

ALWAYS the header's arrow reads a plain Back, with no origin noun

WHEN press the header's back arrow GIVEN the link was pasted at the invite door -> InviteEntry opens

WHEN press the header's back arrow GIVEN the link was held from the arrival -> the borrowed view it was opened from comes back

WHEN press the header's back arrow GIVEN the form opened over the signed-in state -> the layer closes onto the signed-in state, untouched

ALWAYS the header's "?" is the screen's one explanation, named About CoGra

WHEN tap the header's "?" -> About opens with a plain Back on its arrow

WHEN About's back arrow is pressed GIVEN About was opened from the form -> the form comes back with every field as it was left

WHEN Join opens again in the same session GIVEN the reader left it by Already have an account? Sign in or the back arrow -> the Handle and Email fields hold what was typed AND the Password field is empty

WHEN the app is launched cold -> NEVER a field of the form holds what was typed before

WHEN press the header's back arrow on SignIn GIVEN SignIn opened from this form over the signed-in state -> the form comes back as a layer over the signed-in state

ALWAYS the Handle field's hint reads 3–30 characters: a–z, 0–9, _ GIVEN the field carries no error line

ALWAYS the Password field's hint reads At least 12 characters. GIVEN the field carries no error line

WHEN press the password's reveal control GIVEN the password is hidden -> the password shows AND the control is named Hide password

WHEN press the password's reveal control GIVEN the password shows -> the password hides AND the control is named Show password

WHEN typing in a field that carries no error line -> NEVER the field turns to its error state before the next press of Create account

WHEN press Create account -> Create account refuses a second press until the registration answers AND NEVER Create account dims

WHEN the registration has not answered 200ms after the press -> Create account reads Creating account… AND NEVER a spinner appears

WHEN the registration has not answered 5s after the press -> Create account still reads Creating account… AND NEVER a slow line or a progress indicator appears

ALWAYS the header's arrow, the "?" and Already have an account? Sign in refuse a press, never dimmed, while Create account waits on its answer

WHEN the account is created -> the applicant days begin on ApplicantFeed

WHEN the account is created GIVEN the form opened over the signed-in state -> the new account's applicant days begin on ApplicantFeed AND this device switches to the new account AND the other account's sessions stay valid wherever they are

WHEN the registration is refused because the handle is taken -> the Handle field's line reads That handle is taken. in place of its hint AND the field takes the error state

WHEN the registration is refused because the email already has an account -> the Email field's line reads That email already has an account. AND the field takes the error state

WHEN press Create account GIVEN the handle is not 3–30 characters of a–z, 0–9 and _ -> the Handle field's line reads A handle is 3–30 characters: a–z, 0–9, _. in place of its hint AND the field takes the error state

WHEN press Create account GIVEN the email does not read as an address -> the Email field's line reads That doesn't look like an email address. AND the field takes the error state

WHEN press Create account GIVEN the password is shorter than 12 characters -> the Password field's line reads A password is at least 12 characters. in place of its hint AND the field takes the error state

WHEN press Create account GIVEN the password is longer than 128 characters -> the Password field's line reads A password is at most 128 characters. in place of its hint AND the field takes the error state

WHEN the registration is refused because the password turned up in a data breach -> the Password field's line reads That password has turned up in a data breach — pick another one. in place of its hint AND the field takes the error state

ALWAYS an errored field's line replaces its hint, and an unerrored field keeps its own

WHEN press Create account GIVEN no answer reaches the device -> the fields keep what was typed AND the line That didn't send. Try again. stands above Create account AND Create account stays, the retry

WHEN tap Already have an account? Sign in -> SignIn opens

ALWAYS Already have an account? Sign in stands GIVEN the form opened over the signed-in state

ALWAYS a line the server answered stands until the next press of Create account, and only a field's local format line re-checks as the text changes

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach

ALWAYS the line By creating your account you accept the Terms. stands directly above Create account, with Terms a door

ALWAYS no checkbox stands on the form

ALWAYS the notice How CoGra handles your data: the Privacy Policy. stands at the form's foot, its own line with Privacy Policy a door, and never inside the accept sentence

WHEN tap Terms -> the Terms open AND the form keeps every field as it was left on the way back

WHEN tap Privacy Policy -> the Privacy Policy opens AND the form keeps every field as it was left on the way back

ALWAYS Create account stands disabled with Waiting for a handle, your email and a password right above it GIVEN Handle, Email or Password is empty

WHEN all three fields hold a character -> Create account wakes AND the line Waiting for a handle, your email and a password goes
