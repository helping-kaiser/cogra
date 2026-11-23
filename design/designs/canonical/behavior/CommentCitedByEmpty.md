# CommentCitedByEmpty · `spec:design:behavior-comment-cited-by-empty`

ALWAYS the comment's postDetail.citedBySheet opens stacked over postDetail.threadSheet, the thread still open beneath its wash

ALWAYS the comment's postDetail.citedBySheet.title reads Cited by, as the post's does

ALWAYS postDetail.citedBySheet.empty alone reads Nothing cites this yet GIVEN nothing cites the comment

ALWAYS the empty sheet never scolds and wears no error colour

ALWAYS the comment's postDetail.citedBySheet orders and draws its rows as the post's does GIVEN something cites the comment

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND postDetail.threadSheet stands open beneath it as it was
