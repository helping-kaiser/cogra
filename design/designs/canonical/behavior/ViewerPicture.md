# ViewerPicture · `spec:design:behavior-viewer-picture`

ALWAYS the viewer is the whole screen on black with nothing behind it

ALWAYS the frame stands whole at its own ratio, never cut

ALWAYS the viewer carries no acts and never shows the description

ALWAYS the dot row holds at most seven slots, sliding centred on the current picture, and the edge dot on a side with more beyond it is drawn smaller

ALWAYS the viewer's spoken name reads Picture N of M and follows the paging, and the dot row is not spoken

WHEN pinch the picture -> the picture zooms

WHEN swipe the pager -> the next or the previous picture of the same set takes the frame AND the dots read the new position

WHEN tap the X -> the viewer closes

WHEN swipe down -> the viewer closes

WHEN press Android Back -> the viewer closes

WHEN tap the backdrop GIVEN a backdrop is visible beside the frame on a wide screen -> the viewer closes

WHEN tap the ground beside the frame GIVEN the phone is rotated and the frame leaves ground at its sides -> the viewer closes

WHEN tap the picture -> NEVER the viewer closes

WHEN the viewer opens -> focus lands on the X

WHEN the viewer closes -> focus returns to the frame that opened it

WHEN press the right or the left arrow key -> the next or the previous picture of the same set takes the frame

WHEN swipe or press an arrow key past the last or the first picture -> NEVER the pager wraps to the other end
