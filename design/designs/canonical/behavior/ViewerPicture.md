# ViewerPicture · `spec:design:behavior-viewer-picture`

ALWAYS the viewer is the whole screen on black with nothing behind it

ALWAYS the frame stands whole at its own ratio, never cut

ALWAYS the viewer carries no acts and never shows the description

ALWAYS the dot row holds at most seven slots, sliding centred on the current picture, and the edge dot on a side with more beyond it is drawn smaller

ALWAYS the dot row's spoken name reads Picture N of M

WHEN pinch the picture -> the picture zooms

WHEN swipe the pager -> the next or the previous picture of the same set takes the frame AND the dots read the new position

WHEN tap the X -> the viewer closes

WHEN swipe down -> the viewer closes

WHEN press Android Back -> the viewer closes

WHEN tap the backdrop GIVEN a backdrop is visible beside the frame on a wide screen -> the viewer closes

WHEN tap the ground beside the frame GIVEN the phone is rotated and the frame leaves ground at its sides -> the viewer closes

WHEN tap the picture -> NEVER the viewer closes
