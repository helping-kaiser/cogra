# SignIn · `spec:design:behavior-sign-in`

ALWAYS the header's arrow reads Back and is a link to the bare view, never history GIVEN SignIn did not open from the join layer over the signed-in state

WHEN press the header's back arrow -> FeedBare opens

WHEN tap Already have an account? Sign in on Join GIVEN Join opened over the signed-in state -> SignIn opens over the join layer

WHEN press the header's back arrow GIVEN SignIn opened from the join layer over the signed-in state -> the join layer comes back AND NEVER FeedBare opens

WHEN the sign-in is taken GIVEN SignIn opened from the join layer over the signed-in state -> this device switches to the account signed in, exactly as Create account switches it AND the other account's sessions stay valid wherever they are AND the app opens where app-open lands for the account signed in

WHEN press the password's reveal control GIVEN the password is hidden -> the password shows AND the control is named Hide password

WHEN press the password's reveal control GIVEN the password shows -> the password hides AND the control is named Show password

ALWAYS Don't remember this account on this device stands unticked until the reader ticks it

WHEN tap Don't remember this account on this device -> the box flips AND nothing else changes

ALWAYS On Android? Download the app (APK) stands only on the web, and the app never carries it

WHEN tap On Android? Download the app (APK) -> the browser downloads the app

WHEN tap Forgot password? -> Reset opens

WHEN tap New here? Enter your invite GIVEN no invite link is held -> InviteEntry opens

WHEN tap New here? Enter your invite GIVEN a live invite link is held -> Join opens with the link in hand AND NEVER the invite door is shown

WHEN tap Just looking? Browse the feed -> FeedBare opens

WHEN press Sign in -> Sign in refuses a second press until the sign-in answers AND NEVER Sign in dims

WHEN the sign-in has not answered 200ms after the press -> Sign in reads Signing in… AND NEVER a spinner appears

WHEN the sign-in answers within 200ms of the press -> NEVER Sign in reads Signing in…

ALWAYS a sign-in lands wherever app-open lands for that account in its state

WHEN the sign-in is taken GIVEN a member whose key is on this device -> Feed opens

WHEN the sign-in is taken GIVEN a member whose key is not on this device -> KeyElsewhere opens

WHEN the sign-in is taken GIVEN a member whose key is not on this device and whose account has no backup -> KeyElsewhereNoBackup opens

WHEN the sign-in is taken GIVEN a member who landed and has not yet vouched back -> VouchBack opens

WHEN the sign-in is taken GIVEN a member whose confirmed deletion is in its grace -> FeedDeleting opens

WHEN the sign-in is taken GIVEN an applicant with tasks left -> ApplicantFeed opens

WHEN the sign-in is taken GIVEN an applicant whose key was made on another device -> ApplicantKeyElsewhere opens

WHEN the sign-in is taken GIVEN an applicant with every task done -> ApplicantWaiting opens

WHEN the sign-in is taken GIVEN an applicant whose application was closed -> ApplicantRejected opens

WHEN the sign-in is taken GIVEN a reused sign-in was detected since the account's last sign-in -> the landing carries the security notice as a card AND NEVER the notice is delivered twice

WHEN the sign-in is taken GIVEN the reader came from the guest gate over an ask link's page -> the ask link's page comes back

WHEN the sign-in is taken GIVEN the reader came from the email change's signed-out landing -> the link's side of the change applies AND its landing follows

WHEN the sign-in is refused for its email and password -> the line That email and password don't match. stands above Sign in AND the fields keep what was typed AND NEVER either field is marked

WHEN the sign-in is refused by the login backoff -> the line Too many tries in a row. Wait a moment, then try again. stands above Sign in AND the fields keep what was typed

WHEN press Sign in GIVEN no answer reaches the device -> the fields keep what was typed AND the line That didn't send. Try again. stands above Sign in AND Sign in stays, the retry

ALWAYS a line the server answered stands until the next press of Sign in, and only a field's local format line re-checks as the text changes

WHEN no answer has come 5s after the press of Sign in -> Sign in still reads Signing in… AND NEVER a slow line or a progress indicator appears

ALWAYS the screen's ways out stay live while Sign in waits on its answer

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach
