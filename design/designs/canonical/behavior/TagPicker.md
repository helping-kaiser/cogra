# TagPicker · `spec:design:behavior-tag-picker`

ALWAYS the list's first row is the canonicalized typed name GIVEN the typed name is a legal tag name

WHEN press the keyboard's action key GIVEN the typed name is a legal tag name -> the first row's name is staged in the composer's tags AND the first row wears the added mark AND NEVER the picker closes

WHEN press the keyboard's action key GIVEN the name field refuses the typed name -> NEVER a tag is staged AND the refusal stays under the name field

WHEN tap a row GIVEN the row wears the add mark -> the row's name is staged in the composer's tags AND the row wears the added mark AND NEVER the picker closes

WHEN tap a row GIVEN the row wears the added mark -> NEVER a tag is unstaged AND NEVER the picker closes

WHEN tap Done -> the picker closes to the composer it was opened from AND NEVER a staged tag is unstaged

WHEN press the header back -> the picker closes to the composer it was opened from AND NEVER a staged tag is unstaged
