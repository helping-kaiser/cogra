# CommentRemovedOther · `spec:design:behavior-comment-removed-other`

ALWAYS another's removed comment keeps its author, its time and its place in the thread's order

ALWAYS postDetail.threadSheet.commentCard.removalMark.line reads Removed by its author where the comment's words were,, and nothing under it but the removal's date

ALWAYS the removed comment keeps postDetail.threadSheet.commentCard.authorChip, postDetail.threadSheet.commentCard.actionRow.stance, postDetail.threadSheet.commentCard.actionRow.reply and postDetail.threadSheet.commentCard.menu, the reader's comment menu whole

ALWAYS the removed comment's replies stay under it and readable, unfolded as the reader left them

WHEN tap the ⋮ on the removed comment -> postDetail.menuSheet rises over the thread, stacked, with the reader's comment menu's rows, its Hide row naming the comment's author

WHEN tap postDetail.threadSheet.commentCard.authorChip on the removed comment -> the author's profile opens, its author surviving the removal

WHEN tap the scrim, swipe postDetail.threadSheet down, press system Back or press Escape -> postDetail.threadSheet closes AND what it was opened over stands as it was
