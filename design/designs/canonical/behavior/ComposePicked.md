# ComposePicked · `spec:design:behavior-compose-picked`

ALWAYS the surface beneath the sheet stays inert while the sheet is up

ALWAYS the first picture in the sheet is the cover

ALWAYS the sheet lists only the accepted pictures, never a refused file

WHEN drag a picture by its handle to a new place -> the pictures take the new order AND the picture now first is the cover

ALWAYS a picture's second line reads Describe or Described, then Make it the cover, Move up and Move down as small inline actions, each only where the move is possible

ALWAYS the cover offers neither Make it the cover nor Move up, and the last picture offers no Move down

WHEN tap Make it the cover -> the picture moves to the head of the list AND it is the cover AND every picture above it moves down one

WHEN tap Move up -> the picture trades places with the one above it AND the picture now first is the cover

WHEN tap Move down -> the picture trades places with the one below it AND the picture now first is the cover

ALWAYS a picture's handle is focusable and named Reorder the cover or Reorder picture, then its place, as Reorder picture 2

WHEN press the up or down arrow key GIVEN a picture's handle has focus -> the picture moves one place that way AND focus stays on its handle

ALWAYS the footnote under the pictures reads The first one is the cover.

WHEN tap a picture's remove control GIVEN more than one picture is picked -> the picture leaves the batch

WHEN tap the last picture's remove control -> the sheet closes AND the pick step comes back with the tray empty AND the title, description, tags and references stay staged in the draft AND NEVER the removal is refused AND NEVER the words stage opens

WHEN tap a picture's Describe -> the describe sheet opens for that picture

WHEN press Done -> the sheet closes to the stage it opened from

WHEN tap the scrim -> the sheet closes to the stage it opened from
