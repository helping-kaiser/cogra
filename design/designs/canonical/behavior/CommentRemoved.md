# CommentRemoved · `spec:design:behavior-comment-removed`

ALWAYS a removed comment keeps its author, its time and its place in the thread's order

ALWAYS postDetail.threadSheet.commentCard.removalMark.line reads Removed by its author where the comment's words were, over postDetail.threadSheet.commentCard.removalMark.detail reading The comment's place in the thread, and every response, remain.

ALWAYS postDetail.threadSheet.commentCard.removalMark.line reads Removed by its author GIVEN the comment went with its author's account deletion, its content sweep chosen

ALWAYS a removed comment carries no postDetail.threadSheet.commentCard.menu

ALWAYS a removed comment keeps postDetail.threadSheet.commentCard.authorChip, postDetail.threadSheet.commentCard.actionRow.stance and postDetail.threadSheet.commentCard.actionRow.reply

WHEN a press-and-hold on a removed comment's stance face lands -> a positive act lands on it as on any other comment

ALWAYS a removed comment's replies stay under it and readable

WHEN tap a comment's View N replies -> the branch unfolds in place AND it stays unfolded for as long as postDetail.threadSheet stays open

ALWAYS postDetail.threadSheet holds the reader's offset across the menu, the confirm and the removed comment, the comment and its branch in view

WHEN tap the scrim, swipe postDetail.threadSheet down, press system Back or press Escape -> postDetail.threadSheet closes AND what it was opened over stands as it was
