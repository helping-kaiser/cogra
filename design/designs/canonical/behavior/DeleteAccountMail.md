# DeleteAccountMail · `spec:design:behavior-delete-account-mail`

WHEN press Send the confirmation link GIVEN the reader is a member -> the request is recorded with its content-sweep choice AND a confirmation link is mailed to the account's address AND the mail screen opens AND NEVER anything is scheduled AND NEVER anything is deleted

ALWAYS the mail screen names the address the link went to

ALWAYS the mail screen says nothing is scheduled and nothing has changed until the link is opened

ALWAYS the mail screen claims no expiry for the link

ALWAYS no deletion band stands GIVEN the deletion is requested and not yet confirmed

WHEN tap Resend the link -> a fresh message goes to the same address, carrying the request's recorded content-sweep choice AND NEVER anything is scheduled

ALWAYS the settings Delete account row carries no status GIVEN a deletion is requested and not yet confirmed

WHEN tap Delete account in settings GIVEN a deletion is requested and not yet confirmed -> the request screen opens again

WHEN press Send the confirmation link GIVEN an earlier request is not yet confirmed -> the new request, with its own content-sweep choice, supersedes the earlier one AND NEVER two requests stand

WHEN the resend has not answered 200ms after the press -> Resend the link reads Resending the link… in its own place AND NEVER a spinner appears

WHEN tap Resend the link GIVEN the reader is offline -> the network error answers

WHEN press the header back arrow -> settings returns AND nothing changes AND NEVER the request is withdrawn

WHEN the mail screen is closed -> nothing changes AND the link stays the whole of the confirmation

WHEN the mailed link is opened -> the deletion is confirmed AND its seven days start from that moment

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach
