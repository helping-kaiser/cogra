# EditPad · `spec:design:behavior-edit-pad`

ALWAYS the edit beneath the wash stays inert while the pad is up

ALWAYS the pad is the ordinary full pad, setting both axes of the opinion the edit's record carries

ALWAYS the pad reads Current opinion and Your pick above the field and Resulting opinion below it, each a label over its own face and pair, never merged into one line

ALWAYS Current opinion reads the author's standing opinion on the post, the sum of its own records and the opinions given through its face

ALWAYS the pad opens at the edit's pick, (0, 0) GIVEN the author has not moved it in this edit

ALWAYS Resulting opinion reads where the pick lands the standing opinion, folded against the raw sum

WHEN drag on the pad field -> the knob and the readouts follow the pick AND NEVER anything is staged

WHEN tap the pad field without dragging -> NEVER the pick moves

WHEN release a drag on the field -> the pick is parked AND NEVER the pick is staged

WHEN press Set -> the pad closes AND the edit's Your opinion row reads the resulting opinion AND the footer's count stays as it was AND NEVER anything is signed before Sign the edit

WHEN press Set GIVEN the pick sits at (0, 0) -> the pad closes AND the edit's record carries (0, 0) AND NEVER a record is added to the batch

WHEN press Cancel -> the pad closes AND nothing is staged AND the edit's pick is what it was

WHEN press the scrim outside the pad, press the system's Back or press Escape -> the pad closes AND nothing is staged AND the edit's pick is what it was

WHEN press Set GIVEN the pick nets the standing opinion to (0, 0) -> the dialog Walk it all back? opens over the pad, which stays parked beneath it, as it does over every pad AND NEVER the pick is refused

WHEN tap the pad's ? -> the pad's own help opens as a dialog over the edit AND NEVER the pad's body is replaced in place
