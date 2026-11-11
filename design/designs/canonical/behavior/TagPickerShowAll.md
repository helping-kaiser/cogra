# TagPickerShowAll · `spec:design:behavior-tag-picker-show-all`

ALWAYS the picker beneath the sheet stays inert while the sheet is up

ALWAYS the sheet is the seals' staged-tags sheet, unchanged, raised over the picker

ALWAYS the sheet lists every staged tag

ALWAYS the sheet offers no way to add a tag

ALWAYS every change made in the sheet applies the moment it is made, and none waits on Done

WHEN tap a tag's remove control GIVEN more than three tags stay staged -> the tag leaves the post AND it leaves the picker's staged section behind the sheet AND NEVER a dialog asks

WHEN tap a tag's remove control GIVEN three tags or fewer stay staged and at least one stays -> the tag leaves the post AND the picker's staged section behind the sheet shows every one still staged, with no Show all under them AND the sheet stays open AND NEVER a dialog asks

WHEN tap the last tag's remove control -> the tag leaves the post AND the sheet closes to the picker AND NEVER a dialog asks

WHEN tap a tag's name -> the tag's pair opens in a sheet

WHEN press Done -> the sheet closes to the picker AND everything already applied stands

WHEN tap the scrim, swipe the sheet down, press system Back or press Escape -> the sheet closes to the picker AND everything already applied stands AND NEVER a change made in the sheet is undone
