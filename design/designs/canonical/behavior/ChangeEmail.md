# ChangeEmail · `spec:design:behavior-change-email`

ALWAYS the request asks for the new email and the current password

ALWAYS the request names the current address and says a code goes there and a link to the new address, and that the email stays unchanged until both are answered

ALWAYS the request carries no code field

ALWAYS the form opens at rest, nothing marked

WHEN typing in either field GIVEN the field is not marked -> NEVER the field is marked before the next press of Change email

WHEN tap reveal password -> the current password shows

WHEN press Change email -> the confirmation opens AND a code is mailed to the current address AND a link is mailed to the new address AND the account's email stays unchanged AND the Email row reads Change pending

WHEN press Change email GIVEN the current password is wrong -> the Current password field reads That password isn't right. AND NEVER a message is sent

WHEN press Change email GIVEN the new address already belongs to another account -> NEVER the request says so

WHEN the request has not answered 200ms after the press -> Change email reads Changing email… in its own place AND NEVER a spinner appears

WHEN press Change email GIVEN no answer reaches the device -> the fields keep what was typed AND the line That didn't send. Try again. stands above Change email AND Change email stays, the retry AND NEVER a message is sent

WHEN press Change email GIVEN the account's mail budget is spent -> the line Too many tries. Wait a little, then try again. stands above Change email AND Change email stays AND NEVER a message is sent

WHEN press the header back arrow -> settings returns AND NEVER a message is sent

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach

ALWAYS Change email stands disabled with Waiting for a new email and your password right above it GIVEN New email or Current password is empty

WHEN both fields hold a character -> Change email wakes AND the line Waiting for a new email and your password goes

WHEN press Change email GIVEN the new address is not an email address -> the New email field reads That doesn't look like an email address. AND NEVER a message is sent

WHEN typing in New email GIVEN the field reads That doesn't look like an email address. -> the line re-checks as the reader types and goes once the address is well formed

WHEN typing in Current password GIVEN the field reads That password isn't right. -> the line stands until the next press of Change email

ALWAYS the Current password field names the account by a hidden username carrying the current address
