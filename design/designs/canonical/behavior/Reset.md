# Reset · `spec:design:behavior-reset`

WHEN tap Forgot password? on the sign-in screen -> Reset opens

WHEN press the header's back arrow -> SignIn opens

WHEN press Send reset link -> Send reset link refuses a second press until the request answers AND NEVER Send reset link dims

WHEN the request has not answered 200ms after the press -> Send reset link reads Sending reset link… AND NEVER a spinner appears

WHEN the request answers -> the status line reads If that email has an account, a reset link is on its way. The link works once and expires after 15 minutes. AND NEVER the screen says whether that email has an account

ALWAYS the request answers the same way whether or not the email has an account, and whether or not the account's own sending budget is spent

ALWAYS the quiet note under the status line says the reset restores the sign-in only, never the key

WHEN the reset mail's link is opened GIVEN the link is live -> ResetNew opens

WHEN press Send reset link GIVEN no answer reaches the device -> the field keeps what was typed AND the line That didn't send. Try again. stands above Send reset link AND Send reset link stays, the retry

WHEN no answer has come 5s after the press of Send reset link -> Send reset link still reads Sending reset link… AND NEVER a slow line or a progress indicator appears

ALWAYS the screen's ways out stay live while Send reset link waits on its answer

ALWAYS the status line stands only after a press of Send reset link, never at rest

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach

ALWAYS Send reset link stands disabled with Waiting for your email right above it GIVEN Email is empty

WHEN the first character is typed in Email -> Send reset link wakes AND the line Waiting for your email goes
