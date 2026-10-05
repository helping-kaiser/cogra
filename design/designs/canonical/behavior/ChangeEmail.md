# ChangeEmail · `spec:design:behavior-change-email`

ALWAYS the request asks for the new email and the current password

ALWAYS the request names the current address and says a code goes there and a link to the new address, and that the email stays unchanged until both are answered

ALWAYS the request carries no code field

ALWAYS the form opens at rest, nothing marked

WHEN typing in either field GIVEN the field is not marked -> NEVER the field is marked before the next press of Change email

WHEN tap reveal password -> the current password shows

WHEN press Change email -> the confirmation opens AND a code is mailed to the current address AND a link is mailed to the new address AND the account's email stays unchanged AND the Email row reads Change pending

WHEN press Change email GIVEN the new address already belongs to another account -> NEVER the request says so

WHEN the request has not answered 200ms after the press -> Change email reads Changing email… in its own place AND NEVER a spinner appears

WHEN press Change email GIVEN the reader is offline -> the network error answers AND NEVER a message is sent

WHEN press the header back arrow -> settings returns AND NEVER a message is sent

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach
