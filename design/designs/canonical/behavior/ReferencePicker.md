# ReferencePicker · `spec:design:behavior-reference-picker`

ALWAYS a staged reference stands only in the staged section above the results

WHEN tap a result row -> the row's target is staged in the composer's references AND the row moves into the staged section AND the status message announces the stage AND NEVER the picker closes

WHEN tap the remove control of a staged row -> the row's target is unstaged from the composer's references AND the row leaves the staged section AND the status message announces the unstage AND NEVER the picker closes

WHEN tap Done -> the picker closes to the composer it was opened from AND NEVER a staged reference is unstaged

WHEN press the header back -> the picker closes to the composer it was opened from AND NEVER a staged reference is unstaged

WHEN tap a result row GIVEN the row's target is withdrawn in the edit the picker was opened from -> the target's withdrawal is unstaged AND NEVER a second record is staged for the target

ALWAYS the back arrow reads Back to the post from a post's composer or its edit, and Back to the comment from a reply's composer or a comment's edit

WHEN the picker opens -> the search field takes focus AND the keyboard rises
