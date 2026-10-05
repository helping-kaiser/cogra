# Verified · `spec:design:behavior-verified`

WHEN the verification mail's link is opened in a browser -> Verified opens AND the email is verified, the link being the proof

ALWAYS the verification lands whether or not this browser holds a CoGra session

ALWAYS the screen carries no header and no back arrow

ALWAYS the mark, the heading and the line stand centred, and Back to CoGra is a text button, the one way on

WHEN press Back to CoGra GIVEN the application is still running -> ApplicantFeed opens

WHEN press Back to CoGra GIVEN the account is already a member -> Feed opens

WHEN press Back to CoGra GIVEN this browser holds no CoGra session -> SignIn opens AND NEVER the button's words change
