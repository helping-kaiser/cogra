# TagPickerTyping · `spec:design:behavior-tag-picker-typing`

ALWAYS the list's first row is the typed name canonicalized, one leading # stripped and lowercased, with Signs as #name as its second line

ALWAYS a name in use that is the typed name stands as the first row alone, never listed twice

ALWAYS the rows the index matches stand under the first row

ALWAYS the line Letters, digits, dot, dash and underscore. Capitals become lowercase. stands under the name field GIVEN the typed name is a legal tag name

WHEN typing -> the first row follows the name as it is typed

WHEN a character no tag name may carry is typed -> the first row goes AND the line under the name field turns into the refusal

WHEN tap the first row -> the typed name is staged in the composer's tags AND the row moves into the staged section AND the status message announces the stage AND NEVER the picker closes

WHEN tap Done -> the picker closes to the composer it was opened from AND every staged tag is kept AND NEVER the typed name is staged by leaving

WHEN press the header back -> the picker closes to the composer it was opened from AND every staged tag is kept AND NEVER the typed name is staged by leaving

ALWAYS the back arrow reads Back to the post from a post's composer or its edit, and Back to the comment from a reply's composer or a comment's edit
