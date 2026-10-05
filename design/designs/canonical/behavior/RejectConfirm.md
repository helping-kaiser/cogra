# RejectConfirm · `spec:design:behavior-reject-confirm`

WHEN tap a row's close on Invites -> the dialog Close @imke's application? opens, named for the row it was raised from, with It leaves your list and @imke is told. Their account stays exactly as it is — signed in, and free to keep reading. and This is your call and nobody else's. Any member can still vouch them in, and @imke gets a link to ask with.

ALWAYS one dialog serves every row's close, a ready application's, one not fully registered yet and a kept approval's alike

WHEN the closing is taken GIVEN the row was a kept approval -> the kept vouch is dropped AND nothing is signed

ALWAYS Keep it is the filled answer in the right-hand slot and Close it the quiet one on the left

ALWAYS the dialog carries no error colour and no deletion language

ALWAYS the invites list beneath the scrim stays inert while the dialog is up

WHEN press Close it -> the dialog stays up until the closing answers AND Close it refuses a second press AND NEVER Close it dims

WHEN the closing has not answered 200ms after the press -> Close it reads Closing it… AND NEVER a spinner appears

WHEN the closing is taken -> the dialog closes AND the row leaves this reader's list AND the applicant is told AND focus moves to what now stands in the row's place

ALWAYS closing an application removes nothing from the record: the person keeps the account they made, signed in and free to read, and any other member can still vouch them in

WHEN the closing does not go through -> the dialog stays up with its pair AND the line That didn't send. Try again. stands in it AND Close it reads Retry AND the application is still waiting

WHEN press Keep it -> the dialog closes AND the application is still waiting

WHEN tap the scrim, press the system's Back or press Escape -> the dialog closes AND nothing is closed
