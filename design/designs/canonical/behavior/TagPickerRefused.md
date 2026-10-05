# TagPickerRefused · `spec:design:behavior-tag-picker-refused`

ALWAYS the name field wears the error ring GIVEN the typed name is refused

ALWAYS the line A tag name is letters, digits, dot, dash and underscore. stands under the name field in place of the rule GIVEN the typed name carries a character no name may carry

ALWAYS the line A tag name is at most 128 characters. stands under the name field in place of the rule GIVEN the typed name is longer than 128 characters

ALWAYS no first row stands and the list is empty without a message GIVEN the typed name is refused

WHEN the refusal appears -> the refusal line is announced AND NEVER the status message speaks

WHEN typing on GIVEN the typed name is still refused -> the refusal holds AND NEVER a tag is staged

WHEN the offending characters are gone -> the first row comes back AND the rule line returns in place of the refusal

WHEN tap Done -> the picker closes to the composer it was opened from AND every staged tag is kept AND NEVER the refused name adds a tag

WHEN press the header back -> the picker closes to the composer it was opened from AND every staged tag is kept AND NEVER the refused name adds a tag

ALWAYS the back arrow reads Back to the post from a post's composer or its edit, and Back to the comment from a reply's composer or a comment's edit
