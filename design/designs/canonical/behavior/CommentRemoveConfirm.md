# CommentRemoveConfirm · `spec:design:behavior-comment-remove-confirm`

ALWAYS the dialog is titled Remove this comment? and comes up over the thread, the thread still where the menu was opened

ALWAYS Keep it is the filled answer and Remove a text button in no colour

WHEN tap Remove -> Remove refuses a second press until the removal answers AND NEVER Remove dims

WHEN the removal has not answered 200ms after the press -> Remove reads Removing… AND NEVER a spinner appears

WHEN the removal is taken -> the dialog closes AND the comment's words and pictures give way to the mark Removed by its author in the comment's own place

WHEN the removal does not go through -> the dialog stays up with its pair AND its commitment reads Retry AND NEVER the comment is marked removed

WHEN tap Keep it -> the dialog closes AND the thread stands as it was

WHEN tap the scrim -> the dialog closes AND nothing is removed
