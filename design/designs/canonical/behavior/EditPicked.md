# EditPicked · `spec:design:behavior-edit-picked`

ALWAYS the edit beneath the sheet stays inert while the sheet is up

ALWAYS the sheet lists the edit's own pictures in the edit's order

ALWAYS the first picture in the sheet is the cover

ALWAYS every change made in the sheet applies the moment it is made, and none waits on Done

WHEN drag a picture by its handle to a new place -> the pictures take the new order AND the picture now first is the cover

ALWAYS a picture's second line reads Describe or Described, then postEdit.pickedSheet.picture.makeCover, postEdit.pickedSheet.picture.moveUp and postEdit.pickedSheet.picture.moveDown as small inline actions, each only where the move is possible

ALWAYS the cover offers neither postEdit.pickedSheet.picture.makeCover nor postEdit.pickedSheet.picture.moveUp, and the last picture offers no postEdit.pickedSheet.picture.moveDown

WHEN tap postEdit.pickedSheet.picture.makeCover -> the picture moves to the head of the list AND it is the cover AND every picture above it moves down one

WHEN tap postEdit.pickedSheet.picture.moveUp -> the picture trades places with the one above it AND the picture now first is the cover

WHEN tap postEdit.pickedSheet.picture.moveDown -> the picture trades places with the one below it AND the picture now first is the cover

ALWAYS a picture's handle is focusable and named Reorder the cover or Reorder picture, then its place, as Reorder picture 2

WHEN press the up or down arrow key GIVEN a picture's handle has focus -> the picture moves one place that way AND focus stays on its handle

ALWAYS the footnote under the pictures reads The first one is the cover.

WHEN tap a picture's remove control GIVEN more than one picture is in the body -> the picture leaves the edit's batch

WHEN tap the last picture's remove control -> the sheet closes onto the words edit AND the body becomes words AND the words field arrives empty AND NEVER the removal is refused

WHEN tap the last picture's remove control GIVEN the post carries a description -> the media-to-words flip drops the standing description with the last picture AND NEVER the signed edit carries a description

WHEN tap a picture's Describe -> the describe sheet opens for that picture

WHEN press Done -> the sheet closes to the edit AND everything already applied stands

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes to the edit AND everything already applied stands AND NEVER a change made in the sheet is undone
