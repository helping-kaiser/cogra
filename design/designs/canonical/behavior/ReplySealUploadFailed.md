# ReplySealUploadFailed · `spec:design:behavior-reply-seal-upload-failed`

WHEN one of the reply's picture uploads fails while the seal waits on it -> the gate line reads One picture didn't upload. Signing waits for it. followed by Retry AND Sign comment is disabled

ALWAYS the gate line's fact One picture didn't upload. wears the error ink and Signing waits for it. the quiet voice

ALWAYS Sign comment is disabled and the gate line says why GIVEN the failed reading stands

ALWAYS every row of the reply's seal reads back as it did while the upload ran GIVEN the failed reading stands

ALWAYS no Remove it stands on the reply's seal

WHEN an upload fails GIVEN Sign comment was pressed while the uploads ran -> the held press drops AND Sign comment reads Sign comment again AND the header back arrow, Back and the header X answer again AND NEVER anything is signed

WHEN press Retry -> the upload starts again AND the gate line returns to its running reading AND Sign comment is enabled again AND NEVER signing proceeds until Sign comment is pressed again

WHEN press Sign comment GIVEN the failed reading stands -> NEVER anything is signed AND NEVER the press is held

WHEN the reader goes one stage back GIVEN the failed reading stands -> the failed picture's tile in the reply composer is marked AND the line One picture didn't upload. stands under the composer's media row with Retry and Remove it

WHEN press Remove it on the failed picture one stage back -> the picture leaves the reply AND the reply's seal has nothing left to wait for on it
