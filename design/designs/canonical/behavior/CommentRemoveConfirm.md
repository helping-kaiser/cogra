# CommentRemoveConfirm · `spec:design:behavior-comment-remove-confirm`

ALWAYS postDetail.dialog.title reads Remove this comment? and postDetail.dialog comes up over postDetail.threadSheet, the thread still where the menu was opened

ALWAYS postDetail.dialog.keep is the filled answer and postDetail.dialog.remove a text button in no colour

WHEN press postDetail.dialog.remove -> postDetail.dialog.remove refuses a second press until the removal answers AND NEVER postDetail.dialog.remove dims

WHEN the removal has not answered 200ms after the press -> postDetail.dialog.remove reads Removing… AND NEVER a spinner appears

WHEN the removal is taken -> postDetail.dialog closes AND the comment's words and pictures give way to postDetail.threadSheet.commentCard.removalMark in the comment's own place, its line reading Removed by its author

WHEN the removal does not go through -> postDetail.dialog stays up with its pair AND postDetail.dialog.line reads That didn't send. Try again. AND postDetail.dialog.remove reads Retry AND NEVER the comment is marked removed

WHEN press postDetail.dialog.keep -> postDetail.dialog closes AND postDetail.threadSheet stands as it was

WHEN tap the scrim -> postDetail.dialog closes AND nothing is removed
