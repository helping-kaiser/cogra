# SignInExpired · `spec:design:behavior-sign-in-expired`

WHEN any call mid-use is answered UNAUTHENTICATED or REFRESH_TOKEN_INVALID -> the sign-in screen opens with You've been signed out. Sign in again to carry on. where the welcome line stands AND NEVER a fault line or the failure voice appears

ALWAYS the signed-out sentence stands in the welcome line's own secondary ink

ALWAYS the draft and any picks kept pending stay on the device through the sign-in

ALWAYS an unbacked key and any picks kept pending stay on the device, sealed, until this device signs in again online with the account's current credentials GIVEN the account is set to forget this device and its session was ended from elsewhere

ALWAYS every control on the screen is SignIn's, with SignIn's outcomes

ALWAYS the header's arrow reads Back and is a link to the bare view, never history

WHEN press the header's back arrow -> FeedBare opens

WHEN press the password's reveal control GIVEN the password is hidden -> the password shows AND the control is named Hide password

WHEN press the password's reveal control GIVEN the password shows -> the password hides AND the control is named Show password

WHEN tap Don't remember this account on this device -> the box flips AND nothing else changes

ALWAYS On Android? Download the app (APK) stands only on the web, and the app never carries it

WHEN tap On Android? Download the app (APK) -> the browser downloads the app

WHEN tap Forgot password? -> Reset opens

WHEN tap New here? Enter your invite -> InviteEntry opens

WHEN tap Just looking? Browse the feed -> FeedBare opens

WHEN press Sign in -> Sign in refuses a second press until the sign-in answers AND NEVER Sign in dims

WHEN the sign-in has not answered 200ms after the press -> Sign in reads Signing in… AND NEVER a spinner appears

WHEN the sign-in is taken GIVEN a member whose key is on this device -> Feed opens AND the draft and any picks kept pending are still there

WHEN the sign-in is taken GIVEN a member whose key is not on this device -> KeyElsewhere opens

WHEN the sign-in is taken GIVEN an applicant -> ApplicantFeed opens

WHEN the sign-in is refused for its email and password -> the line That email and password don't match. stands above Sign in AND the fields keep what was typed

WHEN press Sign in GIVEN no answer reaches the device -> the fields keep what was typed AND the line That didn't send. Try again. stands above Sign in AND Sign in stays, the retry

ALWAYS a line the server answered stands until the next press of Sign in, and only a field's local format line re-checks as the text changes

WHEN no answer has come 5s after the press of Sign in -> Sign in still reads Signing in… AND NEVER a slow line or a progress indicator appears

ALWAYS the screen's ways out stay live while Sign in waits on its answer
