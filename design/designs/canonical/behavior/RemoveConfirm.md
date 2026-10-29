# RemoveConfirm · `spec:design:behavior-remove-confirm`

ALWAYS postDetail.dialog.keep is the filled answer and postDetail.dialog.remove the quiet one

ALWAYS postDetail.dialog.remove carries no error colour

WHEN press postDetail.dialog.remove -> postDetail.dialog stays up on Remove until the removal answers AND postDetail.dialog.remove refuses a second press AND NEVER postDetail.dialog.remove dims

WHEN the removal has not answered 200ms after the press -> postDetail.dialog.remove reads Removing… AND NEVER a spinner appears

WHEN the removal is taken -> the post stands as its mark, Removed by its author AND NEVER the post leaves without a mark

WHEN the removal does not go through -> postDetail.dialog stays up with its pair AND postDetail.dialog.line reads That didn't send. Try again. AND postDetail.dialog.remove reads Retry AND the post is not removed

WHEN press postDetail.dialog.keep -> postDetail.dialog closes AND nothing is removed

WHEN tap the scrim -> postDetail.dialog closes AND nothing is removed
