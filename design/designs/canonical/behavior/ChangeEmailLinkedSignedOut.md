# ChangeEmailLinkedSignedOut · `spec:design:behavior-change-email-linked-signed-out`

WHEN the new address's link is opened GIVEN no session is on this device and the link's change still waits on its sides -> the landing reads Sign in to finish the change AND names the new address the link confirms AND says it counts once signed in AND NEVER the link's side lands before sign-in

WHEN the new address's link is opened GIVEN no session is on this device and the link's change ran out, was canceled or already applied, or the link is not one the app knows -> the landing reads This link doesn't work anymore AND says The change it belonged to may have run out, been canceled or already happened — this link can't move your email anymore. AND its way on reads Sign in AND NEVER an address appears

ALWAYS one landing answers every link that no longer works and every link the app does not know, and it never says which happened GIVEN no session is on this device

ALWAYS the signed-out landing carries no mark, no back arrow and one way on, Sign in

WHEN the new address's link is opened GIVEN this device is signed in as a different account -> the landing reads This link isn't for this account AND says it confirms a new address for another account and nothing changed here AND its way on reads Back to settings AND NEVER the link's side applies AND NEVER the session switches

WHEN tap Sign in GIVEN the link's change still waits on its sides -> the sign-in screen opens holding the link

WHEN tap Sign in GIVEN the link no longer works or is not one the app knows -> the sign-in screen opens AND NEVER it holds the link

WHEN sign-in succeeds GIVEN the sign-in began from this landing and the link's change still waits on its sides -> the link's side applies AND the change's signed-in landing follows, first side or last

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach
