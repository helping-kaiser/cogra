# CommentRefsSheet · `spec:design:behavior-comment-refs-sheet`

WHEN tap postDetail.threadSheet.commentCard.tagsLine.counts -> postDetail.refsSheet rises over the thread, stacked, AND the thread stands beneath its wash

ALWAYS postDetail.refsSheet holds the comment's every signed tag and reference as one row, its mark, its name and its signed pair, as the post's sheet holds the post's

ALWAYS postDetail.refsSheet.title reads Tags & references

WHEN tap a tag row -> the tag's page opens

WHEN tap a post's reference row -> the cited post opens

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND the thread stands as it was left
