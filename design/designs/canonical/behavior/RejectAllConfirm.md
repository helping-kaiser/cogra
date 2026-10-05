# RejectAllConfirm · `spec:design:behavior-reject-all-confirm`

WHEN tap a group's Close all on Invites -> the dialog Close all 4 applications from this link? opens with the count of applications still waiting on that link in its title, and its two sentences: the people leave your list and are told, their accounts stay as they are, and any member can still vouch any of them in

ALWAYS the count counts only applications still waiting on the link, never one already closed and never one approved

ALWAYS the dialog names no handles

ALWAYS Close all is named in full for the accessibility tree, as Close all 4 applications from this link

ALWAYS a group carries no Close all GIVEN only one application waits on its link

ALWAYS Keep them is the filled answer in the right-hand slot and Close them the quiet one on the left

ALWAYS the dialog carries no error colour and no deletion language

ALWAYS the invites list beneath the scrim stays inert while the dialog is up

WHEN press Close them -> the dialog stays up until the closing answers AND Close them refuses a second press AND NEVER Close them dims

WHEN the closing has not answered 200ms after the press -> Close them reads Closing them… AND NEVER a spinner appears

WHEN the closing is taken -> the dialog closes AND every application still waiting on that link leaves this list at once AND each person is told AND NEVER an application already closed is closed again

ALWAYS closing a group removes nothing from the record: each person keeps the account they made, signed in and free to read, and any member can still vouch any of them in

WHEN the closing does not go through -> the dialog stays up with its pair AND the line That didn't send. Try again. stands in it AND Close them reads Retry AND the group is still waiting, all of it

WHEN press Keep them -> the dialog closes AND the group is still waiting, all of it

WHEN tap the scrim, press the system's Back or press Escape -> the dialog closes AND nothing is closed
