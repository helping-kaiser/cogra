# ComposeCover · `spec:design:behavior-compose-cover`

ALWAYS the preview stands at the shape the clip will post at, never as a square specimen of another shape

ALWAYS the frames offered are the clip's own at 1s, 10%, 50% and 90%

WHEN the clip is short enough that two offered frames land on one frame -> that frame is offered once

WHEN the step opens GIVEN the device has not finished cutting the clip's frames -> the strip's caption reads Reading the video… once the frames are 200ms late AND NEVER a spinner appears

WHEN the step opens GIVEN the author has picked no face -> NEVER a frame stands chosen

WHEN tap a frame -> that frame is the clip's cover AND NEVER a crop opens

WHEN a frame is chosen as the cover -> the frame is extracted on the device AND it uploads as a picture of the author's own

WHEN tap the picture tile -> the device's own picker opens AND on the web the browser's file dialog opens

WHEN a picture of the author's own is picked for the cover -> it passes the crop locked to the clip's shape AND only the cropped export leaves the device

WHEN a picture of the author's own comes back from the cover's crop -> it stands in the picture tile's place in the strip, outlined as chosen AND the frames dim around it AND the preview shows it

WHEN tap the author's own picture in the strip -> the device's own picker opens again AND the picture it brings passes the cover's crop AND NEVER the picture is re-framed in place

ALWAYS the preview shows the chosen cover at the clip's own shape GIVEN a cover is chosen and the preview is not playing

WHEN tap the preview's play -> the preview runs AND the cover gives way to the transport

WHEN press the header back arrow GIVEN a cover was chosen -> the pick step shows the chosen cover beside the clip as its own tile AND the choice is kept

WHEN the step is reached again GIVEN a cover was chosen -> the chosen cover stands chosen AND NEVER the step asks for it afresh

WHEN press the header back arrow GIVEN the step was opened by the details stage's cover tile -> the details stage comes back

WHEN press the header back arrow GIVEN the step was opened by the pick step's cover tile -> the pick step comes back

WHEN press Next GIVEN a cover is chosen -> the details stage opens with the chosen cover beside the clip as its own tile, the door back to this step

WHEN press Next GIVEN the author has picked no face -> the details stage opens with the clip coverless AND the clip's frame 0 is its face AND NEVER Next waits for a pick

WHEN press the header X -> the whole flow is left for where the composer was opened from AND the draft is kept AND NEVER a dialog asks
