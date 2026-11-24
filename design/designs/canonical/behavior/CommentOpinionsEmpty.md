# CommentOpinionsEmpty · `spec:design:behavior-comment-opinions-empty`

ALWAYS the comment's postDetail.opinionsSheet opens stacked over postDetail.threadSheet, the thread still open beneath its wash

ALWAYS the comment's postDetail.opinionsSheet.title reads Opinions on this comment

ALWAYS postDetail.opinionsSheet.empty alone reads No opinions yet GIVEN no opinion is held on the comment

ALWAYS the empty sheet never scolds and wears no error colour

ALWAYS the comment's postDetail.opinionsSheet orders and draws its rows as the post's postDetail.opinionsSheet does GIVEN opinions are held on the comment

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND postDetail.threadSheet stands open beneath it as it was
