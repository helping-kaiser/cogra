# RemoveConfirm · `spec:design:behavior-remove-confirm`

ALWAYS postDetail.dialog.keep is the filled answer and postDetail.dialog.remove the quiet one

ALWAYS postDetail.dialog.remove carries no error colour

WHEN press postDetail.dialog.remove -> postDetail.dialog stays up on Remove until the removal answers AND postDetail.dialog.remove refuses a second press AND NEVER postDetail.dialog.remove dims

WHEN the removal has not answered 200ms after the press -> postDetail.dialog.remove reads Removing… AND NEVER a spinner appears

WHEN the removal is taken -> the post stands as its mark, Removed by its author AND NEVER the post leaves without a mark

WHEN the removal does not go through -> postDetail.dialog stays up with its pair AND postDetail.dialog.line reads That didn't send. Try again. AND postDetail.dialog.remove reads Retry AND the post is not removed

WHEN press postDetail.dialog.keep GIVEN postDetail.dialog.remove was not pressed -> postDetail.dialog closes AND nothing is removed

WHEN tap the scrim GIVEN postDetail.dialog.remove was not pressed -> postDetail.dialog closes AND nothing is removed

WHEN press postDetail.dialog.remove -> postDetail.dialog.keep reads Close in its place from the press itself, filled and live AND NEVER Close dims

WHEN tap Close, tap the scrim, press the system's Back or press Escape GIVEN postDetail.dialog.remove was pressed and has not answered -> postDetail.dialog closes AND the removal goes on AND the post's own row on its detail, under its words reads Removing… in the pending marker's quiet register until it answers AND NEVER the removal is cancelled

WHEN the removal is taken GIVEN postDetail.dialog was closed while it answered -> the line goes AND the post stands as its mark, Removed by its author

WHEN the removal does not go through GIVEN postDetail.dialog was closed while it answered -> the post's own row on its detail, under its words stands as it was AND says so in the failure voice with Retry, its words waiting for jakob (backlog 167) AND NEVER the snackbar carries the failure
