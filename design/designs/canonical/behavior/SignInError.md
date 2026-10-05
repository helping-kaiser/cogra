# SignInError · `spec:design:behavior-sign-in-error`

WHEN the sign-in is refused for its email and password -> the line That email and password don't match. stands above Sign in AND the fields keep what was typed AND NEVER either field is marked

ALWAYS the line speaks in the fault voice and accuses neither the email nor the password

WHEN typing in either field GIVEN the line stands -> the line stands AND NEVER it goes before the next press of Sign in

ALWAYS the header's arrow reads Back and is a link to the bare view, never history

WHEN press the header's back arrow -> FeedBare opens

WHEN press the password's reveal control GIVEN the password is hidden -> the password shows AND the control is named Hide password

WHEN press the password's reveal control GIVEN the password shows -> the password hides AND the control is named Show password

WHEN tap Don't remember this account on this device -> the box flips AND nothing else changes

ALWAYS On Android? Download the app (APK) stands only on the web, and the app never carries it

WHEN tap On Android? Download the app (APK) -> the browser downloads the app

WHEN tap Forgot password? -> Reset opens

WHEN tap New here? Enter your invite GIVEN no invite link is held -> InviteEntry opens

WHEN tap New here? Enter your invite GIVEN a live invite link is held -> Join opens with the link in hand AND NEVER the invite door is shown

WHEN tap Just looking? Browse the feed -> FeedBare opens

WHEN press Sign in -> Sign in refuses a second press until the sign-in answers AND NEVER Sign in dims

WHEN the sign-in has not answered 200ms after the press -> Sign in reads Signing in… AND NEVER a spinner appears

WHEN the sign-in is taken -> the line goes AND the app opens where app-open lands for that account in its state, as SignIn's own sign-in lands

WHEN the sign-in is refused again for its email and password -> the line stands in place AND NEVER the screen changes

WHEN the sign-in is refused by the login backoff -> the line reads Too many tries in a row. Wait a moment, then try again. in the same place

WHEN press Sign in GIVEN no answer reaches the device -> the fields keep what was typed AND the line That didn't send. Try again. stands above Sign in AND Sign in stays, the retry

ALWAYS a line the server answered stands until the next press of Sign in, and only a field's local format line re-checks as the text changes
