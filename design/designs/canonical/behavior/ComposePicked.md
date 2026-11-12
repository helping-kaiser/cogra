# ComposePicked · `spec:design:behavior-compose-picked`

ALWAYS the surface beneath the sheet stays inert while the sheet is up

ALWAYS the first picture in the sheet is the cover

ALWAYS the sheet lists only the accepted pictures, never a refused file

ALWAYS every change made in the sheet applies the moment it is made, and none waits on Done

WHEN drag a picture by its handle to a new place -> the pictures take the new order AND the picture now first is the cover

ALWAYS a picture's second line reads Describe or Described, then composeDetails.pickedSheet.picture.makeCover, composeDetails.pickedSheet.picture.moveUp and composeDetails.pickedSheet.picture.moveDown as small inline actions, each only where the move is possible

ALWAYS the cover offers neither composeDetails.pickedSheet.picture.makeCover nor composeDetails.pickedSheet.picture.moveUp, and the last picture offers no composeDetails.pickedSheet.picture.moveDown

WHEN tap composeDetails.pickedSheet.picture.makeCover -> the picture moves to the head of the list AND it is the cover AND every picture above it moves down one

WHEN tap composeDetails.pickedSheet.picture.moveUp -> the picture trades places with the one above it AND the picture now first is the cover

WHEN tap composeDetails.pickedSheet.picture.moveDown -> the picture trades places with the one below it AND the picture now first is the cover

ALWAYS a picture's handle is focusable and named Reorder the cover or Reorder picture, then its place, as Reorder picture 2

WHEN press the up or down arrow key GIVEN a picture's handle has focus -> the picture moves one place that way AND focus stays on its handle

WHEN tap a picture's remove control GIVEN more than one picture is picked -> the picture leaves the batch

WHEN tap the last picture's remove control -> the sheet closes AND the pick step comes back with the tray empty AND the title, description, tags and references stay staged in the draft AND NEVER the removal is refused AND NEVER the words stage opens

WHEN tap a picture's Describe -> the describe sheet opens for that picture

WHEN press Done -> the sheet closes to the stage it opened from AND everything already applied stands

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes to the stage it opened from AND everything already applied stands AND NEVER a change made in the sheet is undone
