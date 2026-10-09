# DeleteLinkExpired · `spec:design:behavior-delete-link-expired`

WHEN a deletion confirmation link already used, or replaced by a newer request, is opened, in the app or in a browser -> DeleteLinkExpired opens AND NEVER anything is scheduled AND NEVER anything is deleted

ALWAYS one landing answers every deletion link that no longer works, and it never says which happened

ALWAYS deleteAccount.title reads This link doesn't work anymore

ALWAYS deleteAccount.body claims no expiry for the link and names no address and no account

ALWAYS the screen carries no header, no back arrow, no mark and no Resend

ALWAYS deleteAccount.onward reads Back to settings GIVEN a session

ALWAYS deleteAccount.onward reads Sign in GIVEN no session

WHEN tap deleteAccount.onward GIVEN a session -> settings opens AND the deletion's state reads there as it stands

WHEN tap deleteAccount.onward GIVEN no session -> SignIn opens AND NEVER it holds the link

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach

WHEN press system Back -> the platform leaves to wherever the mail link was opened from AND NEVER a CoGra screen opens in its place
