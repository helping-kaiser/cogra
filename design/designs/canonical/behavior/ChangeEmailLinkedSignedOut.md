# ChangeEmailLinkedSignedOut · `spec:design:behavior-change-email-linked-signed-out`

WHEN the new address's link is opened GIVEN no session is on this device -> the landing reads Sign in to finish the change AND names the new address the link confirms AND says it counts once signed in AND NEVER the link's side lands before sign-in

ALWAYS the signed-out landing carries no mark, no back arrow and one way on, Sign in

WHEN tap Sign in -> the sign-in screen opens holding the link

WHEN sign-in succeeds GIVEN the sign-in began from this landing -> the link's side applies AND the change's signed-in landing follows, first side or last
