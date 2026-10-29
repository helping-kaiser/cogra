# Removed · `spec:design:behavior-removed`

ALWAYS postDetail.card.removalMark stands in the post's words and pictures' place

ALWAYS postDetail.card.removalMark.line reads Removed by its author GIVEN the post went with its author's account deletion, its content sweep chosen

ALWAYS postDetail.card.removalMark.detail reads The words and pictures are gone. The post's place in the thread, and every response, remain.

ALWAYS the author's mark never reads like Removed under the platform's rules

ALWAYS postDetail.header carries postDetail.header.back alone and no menu

ALWAYS the post keeps postDetail.card.authorChip, postDetail.card.actionRow.stance, postDetail.card.actionRow.score, postDetail.card.actionRow.comments.count and postDetail.card.actionRow.share

WHEN tap postDetail.card.actionRow.comments -> the thread opens with every response in it

ALWAYS postDetail.header.back names the screen the post was opened from by the post detail's origin table, as Back to feed from the feed and Back to Saved from Saved

WHEN press postDetail.header.back -> the screen the post was opened from comes back, in the state it was left
