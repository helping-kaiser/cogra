# ChangeEmailConfirm · `spec:design:behavior-change-email-confirm`

ALWAYS the confirmation draws both sides of the change as a pair under Both have to land, the code at the current address and the link at the new one, each naming its address

ALWAYS a side reads still waiting until it lands, and confirmed once it has

ALWAYS the account keeps its current address until both sides land, in either order

ALWAYS the confirmation carries one field, for the code from the current address

ALWAYS the confirmation keeps its back arrow, and nothing is lost by leaving it

WHEN the reader comes back to the confirmation GIVEN the change is still in its window -> the confirmation opens on the side still owed, each side's state as it stands

WHEN press Confirm the code GIVEN the code is right and the link has not been opened -> the code's side reads confirmed AND the confirmation stays open, waiting on the link AND the Email row reads Change pending AND NEVER the address moves

WHEN press Confirm the code GIVEN the code is right and the link was opened -> the address moves to the new one AND settings returns AND the snackbar reads Email changed to, then the new address, as Email changed to sol@ferreira.studio. AND the Email row reads the new address

WHEN press Confirm the code GIVEN the code is wrong -> the field reads That code doesn't check out. AND NEVER the change moves

WHEN press Confirm the code GIVEN the change ran out before both sides landed -> the fault line above Confirm the code reads This change ran out before both sides landed. Your email stays as it is — start again from settings. AND NEVER the address moves

WHEN press Confirm the code GIVEN the new address now belongs to another account -> the fault line above Confirm the code reads That address now belongs to another account. Your email stays as it is — if the address frees up before the change runs out, confirming again applies it. AND NEVER the address moves

WHEN press Confirm the code again GIVEN the new address belonged to another account and has freed up within the change's window -> the change applies

WHEN the confirm has not answered 200ms after the press -> Confirm the code reads Confirming the code… in its own place AND NEVER a spinner appears

WHEN press Confirm the code GIVEN no answer reaches the device -> the field keeps what was typed AND the line That didn't send. Try again. stands above Confirm the code AND Confirm the code stays, the retry AND NEVER the change moves

WHEN tap Resend -> both messages go out again AND the snackbar reads Sent again — check both inboxes. AND NEVER a dialog asks

WHEN tap Resend GIVEN the reader is offline -> the network error answers

WHEN tap Cancel the change -> the change is called off AND settings returns AND the Email row reads the address alone AND the snackbar reads Change canceled — your email stays, then the account's address AND NEVER a dialog asks

WHEN tap Cancel the change GIVEN the reader is offline -> the network error answers AND the change still stands

WHEN press the header back arrow -> settings returns AND the change stays live for its window AND the Email row reads Change pending

ALWAYS the page scrolls when its content outgrows the screen at any width or text size, so its action stays within reach
