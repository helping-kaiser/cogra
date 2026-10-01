# ReplyVideo · `spec:design:behavior-reply-video`

ALWAYS a comment carries up to four pictures or one video and its cover, never both kinds

WHEN a video is picked -> it starts uploading at once AND NEVER a crop step opens AND NEVER a pick stage opens

ALWAYS the add control is gone and the line A video is the whole comment. Give it a cover below. stands in its place GIVEN the comment carries a video

ALWAYS the video tile wears the clip's frame 0, with a chosen cover riding as the ringed inset in its corner

ALWAYS the cover row shows from the start GIVEN the clip is horizontal or square

ALWAYS Add a cover stands in the cover row's place GIVEN the clip is vertical and no cover was asked for

WHEN tap Add a cover -> the cover row opens where the door stood

WHEN tap a cover frame -> that frame becomes the clip's face

ALWAYS the cover row offers frames at 1s, 10%, 50% and 90% of the clip, deduplicated on a short clip

WHEN tap the cover row's picture tile -> the platform's own picker opens AND the picture comes back through the cover's crop, locked to the comment's square

ALWAYS a video takes one description for the whole clip and its cover takes none of its own

WHEN tap the video's remove control -> the video leaves AND the composer is words again

ALWAYS the web takes the video state unchanged, its file dialog and drop path playing the picker's part
