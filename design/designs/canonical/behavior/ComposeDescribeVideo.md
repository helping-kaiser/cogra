# ComposeDescribeVideo · `spec:design:behavior-compose-describe-video`

ALWAYS the surface beneath the sheet stays inert while the sheet is up

ALWAYS the line Read aloud to people who can't see it. stands under the sheet's title

ALWAYS the sheet offers one field for the whole clip and none for its cover

ALWAYS the preview wears the play disc

ALWAYS a description is the author's own and optional, never invented by the product

WHEN type in What's in the video -> the one description for the clip is staged AND NEVER the clip's upload waits on it

WHEN press Done GIVEN What's in the video is empty -> NEVER Done refuses

WHEN the description runs past the lines it has -> the field takes one more line AND the sheet grows with it

WHEN the growing sheet meets the ceiling -> the field scrolls inside itself AND NEVER the Done row leaves reach

ALWAYS no count stands under the field GIVEN more than 100 of its 1,000 characters remain

WHEN typing passes the field's 1,000 characters -> the count reads N over in the error colour AND the line A video's description is at most 1,000 characters. takes the hint's place AND Done stays visible and goes inert AND NEVER Done hides AND NEVER a dialog opens

WHEN press Done -> the sheet closes AND the staged description becomes the clip's

WHEN tap the scrim -> the sheet closes AND the clip's description is what it was before the sheet opened AND what was typed in What's in the video is dropped AND NEVER anything staged in the sheet applies

WHEN swipe the sheet down, press system Back or press Escape -> the sheet closes AND the clip's description is what it was before the sheet opened AND what was typed in What's in the video is dropped AND NEVER anything staged in the sheet applies
