# TagPicker · `spec:design:behavior-tag-picker`

ALWAYS the list's first row is the canonicalized typed name GIVEN the typed name is a legal tag name

WHEN press the keyboard's action key GIVEN the typed name is a legal tag name -> the first row's name is staged in the composer's tags AND the picker closes to the composer it was opened from

WHEN press the keyboard's action key GIVEN the name field refuses the typed name -> NEVER a tag is staged AND the refusal stays under the name field
