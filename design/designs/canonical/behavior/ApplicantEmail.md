# ApplicantEmail · `spec:design:behavior-applicant-email`

ALWAYS the change asks for the new address and the current password and nothing else

ALWAYS the paragraph names the address the standing link was sent to

WHEN press Change email -> a fresh verification link goes to the new address AND the link sent to the old address stops working AND the applicant's feed comes back with the verify card printing the new address AND the snackbar reads Sent — the link is on its way to noor@fieldnotes.org. AND NEVER a code goes to the old address

WHEN the fresh link is opened -> the address moves to the new one AND the account is verified in the same step

WHEN press Change email GIVEN the change has not answered 200ms after the press -> the commitment reads Changing email… AND NEVER a spinner appears

WHEN press Change email GIVEN the reader is offline -> the network error answers AND the address on file stands

WHEN the address changes -> NEVER the seven days restart AND NEVER the screen speaks of them

WHEN tap the back arrow -> the applicant's feed comes back at the verify card AND nothing is sent AND the address on file stands
