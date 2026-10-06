# ComposeTags · `spec:design:behavior-compose-tags`

ALWAYS the seal beneath the sheet stays inert while the sheet is up

ALWAYS the sheet lists every staged tag

ALWAYS the sheet offers no way to add a tag

ALWAYS every change made in the sheet applies the moment it is made, and none waits on Done

WHEN tap a tag's remove control GIVEN more tags stay staged than the seal's Tags row holds -> the tag leaves the post AND the Tags row behind the sheet counts one fewer AND NEVER a dialog asks

WHEN tap a tag's remove control GIVEN the tags that stay staged fit the seal's Tags row and at least one stays -> the tag leaves the post AND the Tags row behind the sheet switches live to reading the staged tags back by name AND the sheet stays open AND NEVER a dialog asks

WHEN tap the last tag's remove control -> the tag leaves the post AND the sheet closes to the seal it opened from AND NEVER a dialog asks

WHEN tap a tag's name -> the tag's pair opens in a sheet

WHEN press Done -> the sheet closes to the seal it opened from AND everything already applied stands

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes to the seal it opened from AND everything already applied stands AND NEVER a change made in the sheet is undone
