# EditPicked · `spec:design:behavior-edit-picked`

ALWAYS the edit beneath the sheet stays inert while the sheet is up

ALWAYS the sheet lists the edit's own pictures in the edit's order

ALWAYS the first picture in the sheet is the cover

WHEN drag a picture by its handle to a new place -> the pictures take the new order AND the picture now first is the cover

WHEN tap a picture's remove control GIVEN more than one picture is in the body -> the picture leaves the edit's batch

WHEN tap the last picture's remove control -> the sheet closes onto the words edit AND the body becomes words AND the words field arrives empty AND NEVER the removal is refused

WHEN tap a picture's Describe -> the describe sheet opens for that picture

WHEN press Done -> the sheet closes to the edit

WHEN tap the scrim -> the sheet closes to the edit
