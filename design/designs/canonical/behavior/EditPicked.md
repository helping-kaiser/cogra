# EditPicked · `spec:design:behavior-edit-picked`

ALWAYS the edit beneath the sheet stays inert while the sheet is up

ALWAYS the sheet lists the edit's own pictures in the edit's order

ALWAYS the first picture in the sheet is the cover

ALWAYS every change made in the sheet applies the moment it is made, and none waits on Done

WHEN drag a picture by its handle to a new place -> the pictures take the new order AND the picture now first is the cover

ALWAYS a picture's second line reads Describe or Described, then postEdit.pickedSheet.picture.crop on every picture, then postEdit.pickedSheet.picture.makeCover on every picture but the cover, as small inline actions

WHEN tap postEdit.pickedSheet.picture.makeCover -> the picture moves to the head of the list AND it is the cover AND every picture above it moves down one

ALWAYS a picture's handle is focusable and named Reorder the cover or Reorder picture, then its place, as Reorder picture 2

WHEN press the up or down arrow key GIVEN a picture's handle has focus -> the picture moves one place that way AND focus stays on its handle

ALWAYS a picture's handle carries Move up and Move down as screen-reader actions and draws neither, the cover carrying no Move up and the last picture no Move down

WHEN take a handle's Move up or Move down screen-reader action -> the picture moves one place that way AND the picture now first is the cover

WHEN tap a picture's remove control GIVEN more than one picture is in the body -> the picture leaves the edit's batch

WHEN tap the last picture's remove control -> the sheet closes onto the words edit AND the body becomes words AND the words field arrives empty AND NEVER the removal is refused

WHEN tap the last picture's remove control GIVEN the post carries a description -> the media-to-words flip drops the standing description with the last picture AND NEVER the signed edit carries a description

WHEN tap a picture's Describe -> the describe sheet opens for that picture

WHEN tap postEdit.pickedSheet.picture.crop -> the post's crop opens with that picture in the crop viewport AND the strip holds every picture of the post AND the shape row stands with the post's shape selected

WHEN the post's crop opened from postEdit.pickedSheet.picture.crop closes by Next or by its back arrow -> the sheet stands over the edit again AND the picture's thumbnail shows the framing the crop left it

WHEN press Done -> the sheet closes to the edit AND everything already applied stands

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes to the edit AND everything already applied stands AND NEVER a change made in the sheet is undone
