# ApplicantEmail · `spec:design:behavior-applicant-email`

ALWAYS the change asks for the new address and the current password and nothing else

ALWAYS the paragraph names the address the standing link was sent to

WHEN press Change email -> a fresh verification link goes to the new address AND the link sent to the old address stops working AND the applicant's feed comes back with the verify card printing the new address AND the snackbar reads Sent — the link is on its way to noor@fieldnotes.org. AND NEVER a code goes to the old address

WHEN the fresh link is opened -> the address moves to the new one AND the account is verified in the same step

WHEN press Change email GIVEN the change has not answered 200ms after the press -> the commitment reads Changing email… AND NEVER a spinner appears

WHEN press Change email GIVEN the reader is offline -> the network error answers AND the address on file stands

WHEN the address changes -> NEVER the seven days restart AND NEVER the screen speaks of them

WHEN tap the back arrow -> the applicant's feed comes back at the verify card AND nothing is sent AND the address on file stands

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach

ALWAYS Change email stands disabled with Waiting for a new email and your password right above it GIVEN New email or Current password is empty

WHEN both fields hold a character -> Change email wakes AND the line Waiting for a new email and your password goes

WHEN press Change email GIVEN the current password is wrong -> the Current password field reads That password isn't right. AND NEVER a link is sent

WHEN press Change email GIVEN the new address is not an email address -> the New email field reads That doesn't look like an email address. AND NEVER a link is sent

WHEN typing in New email GIVEN the field reads That doesn't look like an email address. -> the line re-checks as the reader types and goes once the address is well formed

WHEN typing in Current password GIVEN the field reads That password isn't right. -> the line stands until the next press of Change email

WHEN press Change email GIVEN the new address already belongs to another account -> NEVER the request says so

ALWAYS the Current password field names the account by a hidden username carrying the address on file
