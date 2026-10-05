# Verified · `spec:design:behavior-verified`

WHEN the verification mail's link is opened in a browser -> Verified opens AND the email is verified, the link being the proof

ALWAYS the verification lands whether or not this browser holds a CoGra session

ALWAYS the screen carries no header and no back arrow

ALWAYS the mark, the heading and the line stand centred, and Back to CoGra is a text button, the one way on

WHEN press Back to CoGra GIVEN the application is still running -> ApplicantFeed opens

WHEN press Back to CoGra GIVEN the account is already a member -> Feed opens

WHEN press Back to CoGra GIVEN this browser holds no CoGra session -> SignIn opens AND NEVER the button's words change

WHEN the link is opened GIVEN this browser is signed in to a different account -> the link verifies the account it belongs to AND NEVER the browser switches accounts

WHEN press Back to CoGra GIVEN this browser is signed in to a different account -> CoGra opens where app-open lands for the signed-in account

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach

WHEN press system Back -> the platform leaves to wherever the mail link was opened from AND NEVER a CoGra screen opens in its place
