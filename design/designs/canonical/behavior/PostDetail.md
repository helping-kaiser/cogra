# PostDetail · `spec:design:behavior-post-detail`

ALWAYS postDetail.header.menu is the post's one overflow and postDetail.card carries no overflow of its own

ALWAYS postDetail.card.actionRow reads postDetail.card.actionRow.stance, then postDetail.card.actionRow.score, then postDetail.card.actionRow.comments, then postDetail.card.actionRow.share

ALWAYS postDetail.card.actionRow.share carries no number

ALWAYS postDetail.card keeps the one order of its contents a post card has on every surface, with nothing clamped to lift postDetail.card.actionRow above the fold

ALWAYS postDetail.card.opinions counts the opinions held on the post

ALWAYS postDetail.card.citedBy counts what cites the post, apart from postDetail.card.tagsLine's count

ALWAYS postDetail.card.tagsLine's count is the length of the tags-and-references sheet

WHEN tap postDetail.card.media.frame -> the fullscreen viewer opens on that frame AND NEVER the post reopens

WHEN a press-and-hold on postDetail.card.actionRow.stance.anchor signs -> postDetail.card.actionRow.stance.anchor refuses a second press-and-hold until the signing answers AND NEVER postDetail.card.actionRow.stance.anchor.face moves before the signature is taken

WHEN the hold's signing has not answered 200ms after the hold -> the line under postDetail.card.actionRow.stance.anchor.face reads Signing… AND NEVER a spinner appears

WHEN the hold's signing answers within 200ms of the hold -> NEVER the line Signing… appears

WHEN the hold's signing is taken -> postDetail.card.actionRow.stance.anchor.face moves to the new opinion AND the snackbar confirms the signature

WHEN the hold's signing does not go through -> postDetail.card.actionRow.stance.anchor.face stays where it was AND the line under it reads That didn't sign. followed by Retry AND NEVER the snackbar carries the failure

WHEN the hold's signing is refused by the write rule -> postDetail.card.actionRow.stance.anchor.face stays where it was AND the line under it reads You can't sign right now. AND NEVER Retry appears AND NEVER the line takes the failure voice
