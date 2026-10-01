# CommentEditVideo · `spec:design:behavior-comment-edit-video`

ALWAYS the comment's clip is never swapped in an edit

WHEN tap the clip's remove control -> the clip leaves whole, taking the comment's media with it AND the comment is its words

ALWAYS the cover row shows the cover and Change the cover GIVEN the comment's clip has a cover

ALWAYS the cover row shows Add a cover and no picture GIVEN the comment's clip has no cover

WHEN tap Change the cover -> the platform's own picker opens AND NEVER the clip's frames are offered

WHEN a picture comes back from the picker -> it passes through the cover's crop, locked to the comment's square, before it lands on the edit

WHEN the edit with a new cover is signed -> the clip's attachment points at the new picture AND NEVER the clip itself changes
