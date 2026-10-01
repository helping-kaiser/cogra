# RemoveConfirm · `spec:design:behavior-remove-confirm`

ALWAYS Keep it is the filled answer and Remove the quiet one

ALWAYS Remove carries no error colour

WHEN press Remove -> the dialog stays up on Remove until the removal answers AND Remove refuses a second press AND NEVER Remove dims

WHEN the removal has not answered 200ms after the press -> Remove reads Removing… AND NEVER a spinner appears

WHEN the removal is taken -> the post stands as its mark, Removed by its author AND NEVER the post leaves without a mark

WHEN the removal does not go through -> the dialog stays up with its pair AND the line That didn't send. Try again. stands in it AND Remove reads Retry AND the post is not removed

WHEN press Keep it -> the dialog closes AND nothing is removed

WHEN tap the scrim -> the dialog closes AND nothing is removed
