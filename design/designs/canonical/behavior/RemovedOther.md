# RemovedOther · `spec:design:behavior-removed-other`

ALWAYS postDetail.card.removalMark stands in the post's words and pictures' place, postDetail.card.removalMark.when under its line

ALWAYS postDetail.header carries postDetail.header.back and postDetail.header.menu GIVEN the removed post is another's

WHEN tap postDetail.header.menu -> the sheet rises over the detail with Save or Unsave, then Cite in a new post, then Hide with the author's handle, then Cited by, then Opinions on this, then License terms, then Report at the sheet tail, the reader's post menu

ALWAYS the post keeps postDetail.card.authorChip, postDetail.card.actionRow.stance, postDetail.card.actionRow.score, postDetail.card.actionRow.comments.count and postDetail.card.actionRow.share

WHEN tap postDetail.card.actionRow.comments -> the thread opens with every response in it

ALWAYS postDetail.header.back names the screen the post was opened from by the post detail's origin table, as Back to feed from the feed and Back to the profile from a card on another's profile

WHEN press postDetail.header.back -> the screen the post was opened from comes back, in the state it was left