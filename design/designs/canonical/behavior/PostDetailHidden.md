# PostDetailHidden · `spec:design:behavior-post-detail-hidden`

WHEN tap Hide on a person in the reader's post menu opened from the post being read -> the sheet closes AND the post stays on screen as it stood AND postDetail.snackbar reads @ada is hidden — their posts stay out of your feed. with Undo AND NEVER a confirm step appears

ALWAYS nothing on the post marks that its author is hidden

WHEN tap Undo on postDetail.snackbar -> the person is unhidden AND the feed stands as it was before the hide

WHEN tap Undo on postDetail.snackbar GIVEN the unhide does not go through -> the person stays hidden AND the line That didn't go through. with Retry stands in postDetail.card.actionRow until Retry or the next fresh load

WHEN tap Retry in postDetail.card.actionRow -> the unhide is asked again

WHEN the reader returns to the feed GIVEN the hide stands -> the feed holds none of that person's rows
