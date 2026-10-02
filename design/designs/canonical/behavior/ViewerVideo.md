# ViewerVideo · `spec:design:behavior-viewer-video`

ALWAYS the viewer is the whole screen on black with nothing behind it

ALWAYS the clip stands whole at its own ratio, never cut

ALWAYS the viewer carries no acts and never shows the description

ALWAYS the transport carries play and pause between the two skips, and elapsed, the timeline and total on a bar held clear of the screen's bottom edge

ALWAYS the viewer draws no rotate control and no fullscreen toggle

WHEN tap play or pause -> the clip stops or starts where it is

WHEN tap a skip -> the clip moves ten seconds back or forward

WHEN tap or drag the seek line -> the clip moves under the finger

WHEN tap the sound control -> sound turns on or off as the one sticky decision every video shares

WHEN the device is turned to landscape -> the viewer turns with it AND the clip takes the screen's whole height

WHEN tap the X -> the viewer closes

WHEN swipe down -> the viewer closes

WHEN press Android Back -> the viewer closes

WHEN tap the backdrop GIVEN a backdrop is visible beside the frame on a wide screen -> the viewer closes

WHEN tap the ground beside the frame GIVEN the phone is rotated and the frame leaves ground at its sides -> the viewer closes

WHEN tap the clip -> NEVER the viewer closes
