# ChangeEmailLinkedSignedOut · `spec:design:behavior-change-email-linked-signed-out`

WHEN the new address's link is opened GIVEN no session is on this device -> the landing reads Sign in to finish the change AND names the new address the link confirms AND says it counts once signed in AND NEVER the link's side lands before sign-in

ALWAYS the signed-out landing carries no mark, no back arrow and one way on, Sign in

WHEN the new address's link is opened GIVEN this device is signed in as a different account -> the landing reads This link isn't for this account AND says it confirms a new address for another account and nothing changed here AND its way on reads Back to settings AND NEVER the link's side applies AND NEVER the session switches

WHEN tap Sign in -> the sign-in screen opens holding the link

WHEN sign-in succeeds GIVEN the sign-in began from this landing -> the link's side applies AND the change's signed-in landing follows, first side or last

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach
