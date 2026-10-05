# Reset · `spec:design:behavior-reset`

WHEN tap Forgot password? on the sign-in screen -> Reset opens

WHEN press the header's back arrow -> SignIn opens

WHEN press Send reset link -> Send reset link refuses a second press until the request answers AND NEVER Send reset link dims

WHEN the request has not answered 200ms after the press -> Send reset link reads Sending reset link… AND NEVER a spinner appears

WHEN the request answers -> the status line reads If that email has an account, a reset link is on its way. The link works once and expires after 15 minutes. AND NEVER the screen says whether that email has an account

ALWAYS the request answers the same way whether or not the email has an account, and whether or not the account's own sending budget is spent

ALWAYS the quiet note under the status line says the reset restores the sign-in only, never the key

WHEN the reset mail's link is opened -> ResetNew opens

WHEN press Send reset link GIVEN no answer reaches the device -> the field keeps what was typed AND the fault is said in place on the form
