# ChangeHandleConfirm · `spec:design:behavior-change-handle-confirm`

WHEN press Change handle -> the dialog opens over the form, titled Change your handle to, then the new handle, as Change your handle to @solferreira? AND the form stays beneath the scrim, inert AND NEVER the handle changes before an answer

ALWAYS the dialog's body names the cost with the old handle: links to it stop working the moment it changes, and anyone can claim it afterwards

ALWAYS Keep it is the filled answer in the right-hand slot, and Change it the quiet text button

ALWAYS the dialog carries no error colour

WHEN the dialog opens -> focus moves to its title AND focus stays inside the dialog until it closes

WHEN tap Change it -> the dialog stays up until the change answers AND Change it refuses a second press AND NEVER Change it dims

WHEN the change has not answered 200ms after Change it -> Change it reads Changing handle… AND NEVER a spinner appears

WHEN the change has answered within 200ms of Change it -> NEVER the label Changing handle… appears

WHEN tap Keep it, tap the scrim, press system Back or press Escape GIVEN the change is in flight -> NEVER the dialog closes AND NEVER Keep it dims

WHEN tap Change it GIVEN the new handle is free -> settings returns AND the snackbar reads Your handle is now, then the new handle, as Your handle is now @solferreira. AND the Handle row reads the new handle AND the old handle is free for anyone at once AND links to the old handle stop resolving to the reader

WHEN tap Change it GIVEN the new handle is taken -> the dialog closes onto the form AND the New handle field reads That handle is taken. AND NEVER the handle changes

WHEN tap Change it GIVEN no answer reaches the device -> the dialog stays up AND the line That didn't send. Try again. stands in it AND Change it reads Retry AND NEVER the handle changes

WHEN tap Keep it -> the dialog closes onto the form with the new handle still typed AND focus returns to Change handle AND NEVER the handle changes

WHEN tap the scrim -> the dialog closes as Keep it closes it AND NEVER the handle changes

WHEN press system Back or press Escape GIVEN the dialog is open -> the dialog closes as Keep it closes it AND NEVER the handle changes
