# TagPicker · `spec:design:behavior-tag-picker`

ALWAYS the list's first row is the canonicalized typed name GIVEN the typed name is a legal tag name

ALWAYS a staged tag stands only in the staged section above the list

WHEN press the keyboard's action key GIVEN the typed name is a legal tag name -> the first row's name is staged in the composer's tags AND the first row moves into the staged section AND the status message announces the stage AND NEVER the picker closes

WHEN press the keyboard's action key GIVEN tagPicker.nameField refuses the typed name -> NEVER a tag is staged AND the refusal stays under tagPicker.nameField

WHEN tap a row in the list -> the row's name is staged in the composer's tags AND the row moves into the staged section AND the status message announces the stage AND NEVER the picker closes

WHEN tap the remove control of a staged row -> the row's name is unstaged from the composer's tags AND the row leaves the staged section AND the status message announces the unstage AND NEVER the picker closes

WHEN tap Done -> the picker closes to the composer it was opened from AND NEVER a staged tag is unstaged

WHEN press the header back -> the picker closes to the composer it was opened from AND NEVER a staged tag is unstaged

WHEN tap a row in the list GIVEN the row's name is withdrawn in the edit the picker was opened from -> the name's withdrawal is unstaged AND NEVER a second record is staged for the name

WHEN press the keyboard's action key GIVEN the typed name is withdrawn in the edit the picker was opened from -> the name's withdrawal is unstaged AND NEVER a second record is staged for the name

ALWAYS the back arrow reads Back to the post from a post's composer or its edit, and Back to the comment from a reply's composer or a comment's edit

WHEN the picker opens -> tagPicker.nameField takes focus AND the keyboard rises

ALWAYS tagPicker.cap reads Up to 10 tags per post. above the list GIVEN the composer holds ten tags and was opened from a post's composer or its edit

ALWAYS tagPicker.cap reads Up to 10 tags per comment. above the list GIVEN the composer holds ten tags and was opened from a reply's composer or a comment's edit

ALWAYS every row in the list, the typed name's included, is dimmed and takes no tap GIVEN the composer holds ten tags

WHEN press the keyboard's action key GIVEN the composer holds ten tags -> NEVER a tag is staged

WHEN tap the remove control of a staged row GIVEN the composer holds ten tags -> the row's name is unstaged AND tagPicker.cap leaves AND the list takes taps again

WHEN the candidates' read gets no answer -> the typed name's row still stands first AND tagPicker.fault reads Can't reach the server — tags can't load right now. over tagPicker.fault.retry, outlined, where the candidates were AND NEVER the line says try again

WHEN tap tagPicker.fault.retry -> the candidates are read again for the typed name AND the typed name's row stays first

ALWAYS no line stands where the candidates are GIVEN the candidates' read is in flight or found nothing
