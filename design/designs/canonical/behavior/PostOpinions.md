# PostOpinions · `spec:design:behavior-post-opinions`

ALWAYS postDetail.opinionsSheet opens over the post detail, the post still open beneath it

ALWAYS postDetail.opinionsSheet lists everyone holding an opinion on the post, the same for every reader, the author included

ALWAYS postDetail.opinionsSheet's rows stand strongest first, by the for-or-against value, down past nothing into the ones held against

ALWAYS postDetail.opinionsSheet holds as many postDetail.opinionsSheet.opinion rows as postDetail.card.opinions counts

ALWAYS postDetail.opinionsSheet.opinion carries the person, postDetail.opinionsSheet.opinion.avatar, postDetail.opinionsSheet.opinion.name and postDetail.opinionsSheet.opinion.handle, and their public opinion, postDetail.opinionsSheet.opinion.value, its face leading and its pair in the reader's reading mode

ALWAYS postDetail.opinionsSheet.opinion.value.face is 🤔, spoken as the state, never a table face, GIVEN the row's opinion has exactly one number at zero

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND the post stands open beneath it as it was
