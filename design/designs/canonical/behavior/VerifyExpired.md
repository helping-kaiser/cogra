# VerifyExpired · `spec:design:behavior-verify-expired`

WHEN a verification link already used or past its time is opened, in the app or in a browser -> VerifyExpired opens

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

WHEN press Resend the link GIVEN no answer reaches the device -> the screen stays AND the fault is said in place

WHEN press Go to the feed GIVEN the application is still running -> ApplicantFeed opens, its verify card still there

WHEN press Go to the feed GIVEN the account is already a member -> Feed opens

WHEN press Sign in GIVEN no session -> SignIn opens

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach
