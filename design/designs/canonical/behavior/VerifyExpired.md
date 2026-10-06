# VerifyExpired · `spec:design:behavior-verify-expired`

WHEN a verification link already used, replaced or past its time is opened, in the app or in a browser -> VerifyExpired opens

ALWAYS one screen answers both a used link and an expired one, and it never says which happened

ALWAYS the screen carries no header, no back arrow and no mark

ALWAYS the paragraph promises the fresh link only to an account still waiting on its email

ALWAYS Resend the link is outlined and the way on stands plain below it, both following the words

ALWAYS the way on reads Go to the feed GIVEN a session

ALWAYS the way on reads Sign in GIVEN no session

WHEN press Resend the link GIVEN a session -> Resend the link refuses a second press until the request answers AND NEVER Resend the link dims

WHEN the request has not answered 200ms after the press -> Resend the link reads Resending the link… AND NEVER a spinner appears

WHEN the request answers GIVEN a session -> a fresh verification link goes out to the account's address, the same act as the applicant feed's own Resend the link

WHEN press Resend the link GIVEN no session and no Email field stands -> an Email field opens in place above the pair AND NEVER anything is sent yet

WHEN press Resend the link GIVEN no session and the Email field stands -> the request goes to the address typed AND NEVER the screen says whether that address has an account

WHEN press Resend the link GIVEN no answer reaches the device -> the screen stays AND the line That didn't send. Try again. stands above Resend the link AND Resend the link stays, the retry

WHEN press Go to the feed GIVEN the application is still running -> ApplicantFeed opens, its verify card still there

WHEN press Go to the feed GIVEN the account is already a member -> Feed opens

WHEN press Sign in GIVEN no session -> SignIn opens

WHEN the request answers GIVEN a session -> the status line reads If your account is still waiting on its email, a fresh link is on its way to noor@fieldmail.org. under the pair AND NEVER the screen says whether the account was still waiting

WHEN the request answers GIVEN no session -> the status line reads If that address has an account still waiting on its email, a fresh link is on its way. under the pair AND NEVER the screen says whether that address has an account

ALWAYS the status line stands only after a press of Resend the link, never at rest

ALWAYS the request answers the same way whether or not the account is already verified

WHEN press Go to the feed GIVEN a session on a different account than the link's -> the app opens where app-open lands for the signed-in account AND NEVER the device switches accounts

WHEN no answer has come 5s after the press of Resend the link -> Resend the link still reads Resending the link… AND NEVER a slow line or a progress indicator appears

ALWAYS the screen's ways out stay live while Resend the link waits on its answer

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach

WHEN press system Back -> the platform leaves to wherever the mail link was opened from AND NEVER a CoGra screen opens in its place
