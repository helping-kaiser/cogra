# EditPad · `spec:design:behavior-edit-pad`

ALWAYS the edit beneath the wash stays inert while the pad is up

ALWAYS the pad offers one axis, For or Against, and never a second

ALWAYS the pad reads Current opinion and Your pick above the field, each a label over its own face and one number, never merged into one line

ALWAYS Current opinion reads where the post's own records stand, never the opinions given through its face

ALWAYS Your pick reads where the post's own records will stand once the edit lands

ALWAYS the pad opens at the edit's Your opinion row, the current value GIVEN the author has not moved it in this edit

ALWAYS the edit's record carries the pick less the raw sum of the post's own records, 0.00 GIVEN the pick reads the current value

WHEN drag along the field -> the knob and Your pick follow the pick AND NEVER anything is staged

WHEN tap the field without dragging -> NEVER the pick moves

WHEN release a drag on the field -> the pick is parked AND NEVER the pick is staged

WHEN press Set -> the pad closes AND the edit's Your opinion row reads the pick AND the footer's count stays as it was AND NEVER anything is signed before Sign the edit

WHEN press Set GIVEN the pick reads the current value -> the pad closes AND the edit's record carries 0.00 AND NEVER a record is added to the batch

WHEN press Set GIVEN the pick reads 0.00 and the current value does not -> the dialog Walk it all back? opens over the pad, which stays parked beneath it, as it does over every pad AND NEVER the pick is refused

WHEN press Cancel -> the pad closes AND nothing is staged AND the edit's pick is what it was

WHEN press the scrim outside the pad, press the system's Back or press Escape -> the pad closes AND nothing is staged AND the edit's pick is what it was

WHEN tap the pad's ? -> the pad's own help opens as a dialog over the edit AND NEVER the pad's body is replaced in place
