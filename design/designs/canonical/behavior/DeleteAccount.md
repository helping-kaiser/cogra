# DeleteAccount · `spec:design:behavior-delete-account`

WHEN tap Delete account GIVEN the reader is a member and no deletion is in its grace -> the deletion's request screen opens AND NEVER anything is deleted from the row

ALWAYS the request screen carries the back arrow and no bottom bar

WHEN the board opens GIVEN the reader is a member -> the body reads This takes your name off CoGra. What you signed stays on the graph, because it is other people's record as much as yours — what goes is everything that says it was you. AND What goes and What stays stand as a pair under it AND Also remove what I posted stands unticked AND Send the confirmation link stands as the one commitment AND NEVER Delete my account stands

ALWAYS What goes names the profile, the link between the reader and the account, and the sessions with what the account kept for the reader alone GIVEN the reader is a member

ALWAYS What stays names everything the reader signed and everything others signed about them GIVEN the reader is a member

ALWAYS the request asks for no typed confirmation, no password and no are-you-sure GIVEN the reader is a member

ALWAYS the note under the commitment says nothing is deleted until the link is opened, that it then runs in seven days, and that any device can cancel until it does GIVEN the reader is a member

WHEN tap Also remove what I posted -> the box ticks or unticks AND NEVER anything is deleted or scheduled

WHEN press Send the confirmation link GIVEN the reader is a member -> the request is recorded with its content-sweep choice AND a confirmation link is mailed to the account's address AND the mail screen opens AND NEVER anything is scheduled AND NEVER anything is deleted

WHEN press Send the confirmation link GIVEN no answer reaches the device -> the content-sweep choice stays as it was AND the line That didn't send. Try again. stands above Send the confirmation link AND Send the confirmation link stays, the retry AND NEVER a link is mailed

WHEN press the header back arrow -> settings returns AND NEVER a link is mailed AND NEVER anything is deleted

WHEN the board opens GIVEN the reader is an applicant -> the body reads Nothing has landed yet — deleting removes your application and your account right away. AND Delete my account stands as the one commitment AND NEVER Send the confirmation link stands AND NEVER Also remove what I posted stands

WHEN Delete my account is pressed GIVEN the reader is an applicant -> the account and its application are deleted at once AND the reader lands signed out on the bare view AND the snackbar reads Your account is deleted. AND NEVER a confirmation link is mailed AND NEVER the seven-day grace runs AND NEVER the deletion band stands AND NEVER DeleteAccountConfirmed opens

WHEN press Delete my account GIVEN the reader is an applicant and no answer reaches the device -> the line That didn't send. Try again. stands above Delete my account AND Delete my account stays, the retry AND NEVER the account is deleted

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach
