# ReplyVideo · `spec:design:behavior-reply-video`

ALWAYS a comment carries up to four pictures or one video and its cover, never both kinds

WHEN a video is picked -> it starts uploading at once AND NEVER a crop step opens AND NEVER a pick stage opens

ALWAYS the add control is gone and the line A video is the whole comment. Give it a cover below. stands in its place GIVEN the comment carries a video

ALWAYS the video tile wears the clip's frame 0

ALWAYS the clip's tile and the cover's tile stand side by side at 167 × 167 each, the column's 342 less the 8 between them shared

ALWAYS the cover's tile shows the chosen cover wearing the Cover pill and is named Change the cover GIVEN a cover was chosen

ALWAYS the cover's tile is the dashed Add a cover door, its words on the tile, GIVEN no cover was chosen

WHEN tap the cover's tile -> the platform's own picker opens AND the picture comes back through the cover's crop, locked to the comment's square AND NEVER the clip's frames are offered

WHEN press Next on the cover's crop GIVEN it was opened from the cover's tile -> the composer comes back with the picture as the cover in the cover's tile AND in the row's picture tile, outlined as chosen

WHEN press the cover's crop's back arrow GIVEN it was opened from the cover's tile -> the composer comes back as it was AND the picture goes unused

ALWAYS the cover row shows from the start GIVEN the clip is horizontal or square

ALWAYS Add a cover stands in the cover row's place GIVEN the clip is vertical and no cover was asked for

WHEN tap Add a cover -> the cover row opens where the door stood

WHEN tap a cover frame -> that frame becomes the clip's face AND it stands in the cover's tile as it is AND NEVER a crop opens for a frame

ALWAYS the cover row offers frames at 1s, 10%, 50% and 90% of the clip, deduplicated on a short clip

WHEN tap the cover row's picture tile -> the platform's own picker opens AND the picture comes back through the cover's crop, locked to the comment's square

WHEN a picture of the author's own comes back from the cover's crop -> it stands in the row's picture tile's place, outlined as chosen AND the frames dim around it AND it stands in the cover's tile

ALWAYS a video takes one description for the whole clip and its cover takes none of its own

WHEN tap the video's remove control -> the video leaves AND the composer is words again

ALWAYS the web takes the video state unchanged, its file dialog and drop path playing the picker's part

WHEN a photos-app batch holds more than one video GIVEN nothing is in the tray and the batch holds no picture -> the batch's first video becomes the whole comment AND each other video is refused with A comment carries one video. AND NEVER a later clip replaces the first

WHEN a video is dropped GIVEN a clip is staged -> the clip is refused with A comment carries one video. AND NEVER the file joins the composer

WHEN tap Remove it on a refused clip -> the refusal leaves the composer AND the staged clip stays
