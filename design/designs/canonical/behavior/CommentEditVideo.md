# CommentEditVideo · `spec:design:behavior-comment-edit-video`

ALWAYS the comment's clip is never swapped in an edit

WHEN tap the clip's remove control -> the clip leaves whole, taking the comment's media with it AND the comment is its words

ALWAYS the cover row shows the cover and Change the cover GIVEN the comment's clip has a cover

ALWAYS the cover row shows Add a cover and no picture GIVEN the comment's clip has no cover

WHEN tap Change the cover -> the platform's own picker opens AND NEVER the clip's frames are offered

WHEN a picture comes back from the picker -> it passes through the cover's crop, locked to the comment's square, before it lands on the edit

WHEN the edit with a new cover is signed -> the clip's attachment points at the new picture AND NEVER the clip itself changes

ALWAYS the line Uploading N of M — signing waits for the cover. stands above the acts footer GIVEN the cover the edit set is uploading

ALWAYS Sign the edit is enabled GIVEN an upload is running

WHEN press Sign the edit GIVEN an upload is running -> Sign the edit refuses a second press AND NEVER anything is signed before the last upload lands AND NEVER Sign the edit dims

WHEN the signing has not answered 200ms after the press GIVEN Sign the edit was pressed while the uploads ran -> Sign the edit reads Signing the edit… in its own place AND the header back arrow and the header X refuse a press AND NEVER a spinner appears

WHEN the signing has not answered 5s after the press GIVEN Sign the edit was pressed while the uploads ran -> the slow line reads Still signing — the network is slow right now. AND NEVER a progress indicator appears

WHEN the last upload lands GIVEN Sign the edit was pressed while the uploads ran -> signing proceeds AND NEVER a second press is asked

WHEN an upload fails GIVEN Sign the edit was pressed while the uploads ran -> the held press drops AND the gate line takes its fault reading AND Sign the edit reads Sign the edit again AND the header back arrow and the header X answer again AND NEVER anything is signed

ALWAYS Sign the edit is disabled GIVEN the gate line shows its fault reading

WHEN press Retry GIVEN the held press dropped -> the gate runs again AND NEVER signing proceeds until Sign the edit is pressed again

WHEN the last upload lands GIVEN Sign the edit was not pressed -> the upload line goes AND Sign the edit stays as it was
