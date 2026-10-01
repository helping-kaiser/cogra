# ComposePicked · `spec:design:behavior-compose-picked`

ALWAYS the surface beneath the sheet stays inert while the sheet is up

ALWAYS the first picture in the sheet is the cover

ALWAYS the sheet lists only the accepted pictures, never a refused file

WHEN drag a picture by its handle to a new place -> the pictures take the new order AND the picture now first is the cover

WHEN tap a picture's remove control GIVEN more than one picture is picked -> the picture leaves the batch

WHEN tap the last picture's remove control -> the sheet closes AND the pick step comes back with the tray empty AND the title, description, tags and references stay staged in the draft AND NEVER the removal is refused AND NEVER the words stage opens

WHEN tap a picture's Describe -> the describe sheet opens for that picture

WHEN press Done -> the sheet closes to the stage it opened from

WHEN tap the scrim -> the sheet closes to the stage it opened from
