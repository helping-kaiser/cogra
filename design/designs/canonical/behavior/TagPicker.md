# TagPicker · `spec:design:behavior-tag-picker`

ALWAYS the list's first row is the canonicalized typed name GIVEN the typed name is a legal tag name

ALWAYS a staged tag stands only in the staged section above the list

WHEN press the keyboard's action key GIVEN the typed name is a legal tag name -> the first row's name is staged in the composer's tags AND the first row moves into the staged section AND the status message announces the stage AND NEVER the picker closes

WHEN press the keyboard's action key GIVEN the name field refuses the typed name -> NEVER a tag is staged AND the refusal stays under the name field

WHEN tap a row in the list -> the row's name is staged in the composer's tags AND the row moves into the staged section AND the status message announces the stage AND NEVER the picker closes

WHEN tap the remove control of a staged row -> the row's name is unstaged from the composer's tags AND the row leaves the staged section AND the status message announces the unstage AND NEVER the picker closes

WHEN tap Done -> the picker closes to the composer it was opened from AND NEVER a staged tag is unstaged

WHEN press the header back -> the picker closes to the composer it was opened from AND NEVER a staged tag is unstaged

WHEN tap a row in the list GIVEN the row's name is withdrawn in the edit the picker was opened from -> the name's withdrawal is unstaged AND NEVER a second record is staged for the name

WHEN press the keyboard's action key GIVEN the typed name is withdrawn in the edit the picker was opened from -> the name's withdrawal is unstaged AND NEVER a second record is staged for the name
