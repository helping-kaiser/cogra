# PostOpinions · `spec:design:behavior-post-opinions`

ALWAYS postDetail.opinionsSheet opens over the post detail, the post still open beneath it

ALWAYS postDetail.opinionsSheet lists everyone holding an opinion on the post, the same for every reader, the author included

ALWAYS postDetail.opinionsSheet's rows stand strongest first, by the for-or-against value, down past nothing into the ones held against

ALWAYS postDetail.opinionsSheet holds as many rows, postDetail.opinionsSheet.opinion and postDetail.opinionsSheet.redactedOpinion together, as postDetail.card.opinions counts

ALWAYS postDetail.opinionsSheet.redactedOpinion stands for a holder whose account was deleted, where its value puts it, postDetail.opinionsSheet.redactedOpinion.name reading Deleted account in the system's voice, with the reserved disc and no handle line

ALWAYS postDetail.opinionsSheet.redactedOpinion keeps the opinion it holds, read as any row's

WHEN tap postDetail.opinionsSheet.redactedOpinion -> the deleted account's page opens AND its back arrow reads Back to the post

ALWAYS postDetail.opinionsSheet.opinion carries the person, postDetail.opinionsSheet.opinion.avatar, postDetail.opinionsSheet.opinion.name and postDetail.opinionsSheet.opinion.handle, and their public opinion, postDetail.opinionsSheet.opinion.value, its face leading and its pair in the reader's reading mode

ALWAYS postDetail.opinionsSheet.opinion.value.face is 🤔, spoken as the state, never a table face, GIVEN the row's opinion has exactly one number at zero

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes AND the post stands open beneath it as it was

ALWAYS postDetail.opinionsSheet.empty alone reads No opinions yet GIVEN the sheet's read finds no opinion, as when the count it was opened from has gone stale
