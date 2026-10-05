# ResetExpired · `spec:design:behavior-reset-expired`

WHEN a password reset link already used or past its 15 minutes is opened, in the app or in a browser -> ResetExpired opens

ALWAYS one screen answers both a used link and an expired one, and it never says which happened

ALWAYS the screen carries no header, no back arrow and no mark

ALWAYS the heading reads This link doesn't work anymore

ALWAYS the screen never says whose account the link belonged to

ALWAYS Reset your password is outlined and Sign in stands plain below it, both following the words

WHEN press Reset your password -> Reset opens with its field empty

WHEN press Sign in -> SignIn opens

WHEN press Set the new password on ResetNew GIVEN the link was spent or went past its time while the form stood open -> ResetExpired opens AND NEVER the password changes
