# CommentRemoveConfirm · `spec:design:behavior-comment-remove-confirm`

ALWAYS postDetail.dialog.title reads Remove this comment? and postDetail.dialog comes up over postDetail.threadSheet, the thread still where the menu was opened

ALWAYS postDetail.dialog.keep is the filled answer and postDetail.dialog.remove a text button in no colour

WHEN press postDetail.dialog.remove -> postDetail.dialog.remove refuses a second press until the removal answers AND NEVER postDetail.dialog.remove dims

WHEN the removal has not answered 200ms after the press -> postDetail.dialog.remove reads Removing… AND NEVER a spinner appears

WHEN the removal is taken -> postDetail.dialog closes AND the comment's words and pictures give way to postDetail.threadSheet.commentCard.removalMark in the comment's own place, its line reading Removed by its author

WHEN the removal does not go through -> postDetail.dialog stays up with its pair AND postDetail.dialog.line reads That didn't send. Try again. AND postDetail.dialog.remove reads Retry AND NEVER the comment is marked removed

WHEN press postDetail.dialog.keep GIVEN postDetail.dialog.remove was not pressed -> postDetail.dialog closes AND postDetail.threadSheet stands as it was

WHEN tap the scrim GIVEN postDetail.dialog.remove was not pressed -> postDetail.dialog closes AND nothing is removed

WHEN press postDetail.dialog.remove -> postDetail.dialog.keep reads Close in its place from the press itself, filled and live AND NEVER Close dims

WHEN tap Close, tap the scrim, press the system's Back or press Escape GIVEN postDetail.dialog.remove was pressed and has not answered -> postDetail.dialog closes AND the removal goes on AND the comment's own row in the thread, under its words reads Removing… in the pending marker's quiet register until it answers AND NEVER the removal is cancelled

WHEN the removal is taken GIVEN postDetail.dialog was closed while it answered -> the line goes AND the comment gives way to its mark, Removed by its author, in its own place

WHEN the removal does not go through GIVEN postDetail.dialog was closed while it answered -> the comment's own row in the thread, under its words stands as it was AND says That didn't sign. in the failure voice followed by Retry, which asks the same act again, AND NEVER the snackbar carries the failure
