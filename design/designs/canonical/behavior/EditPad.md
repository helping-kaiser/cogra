# EditPad · `spec:design:behavior-edit-pad`

ALWAYS the edit beneath the wash stays inert while the pad is up

ALWAYS the pad offers one axis, For or Against, and never a second

ALWAYS the pick is the edit's own record, the value it adds to the post's backing, and never a value the backing is set to

ALWAYS the pad opens at the edit's pick, 0.00 GIVEN the author has not moved it in this edit

ALWAYS the pad reads Current backing and Your pick above the field and Backing after below it, each a label over its own face and one number, never merged into one line

ALWAYS Current backing reads the post's own records folded, never the opinions given through its face

ALWAYS Backing after reads the raw sum of the post's own records plus the pick, clipped to the axis

ALWAYS a quiet line under Backing after states the raw total and the cap GIVEN the raw sum plus the pick passes ±1

ALWAYS every pick on the field is a pick the edit may carry

ALWAYS any value reads 🤷 GIVEN it is exactly 0.00

WHEN drag along the field -> the knob, Your pick and Backing after follow the pick AND NEVER anything is staged

WHEN tap the field without dragging -> NEVER the pick moves

WHEN release a drag on the field -> the pick is parked AND NEVER the pick is staged

ALWAYS Walk it all back stands on the left of the commit row, pushed away from Cancel and Set

WHEN tap Walk it all back GIVEN the backing nets other than 0.00 -> the pick parks at the opposite of the post's own records' raw sum, clipped to the axis AND NEVER anything is staged AND NEVER a dialog opens

ALWAYS Backing after reads 0.00 once Walk it all back has parked the pick GIVEN the raw sum lies within ±1

ALWAYS Backing after reads as far as one record reaches once Walk it all back has parked the pick GIVEN the raw sum lies past ±1, the rest another edit's

ALWAYS Walk it all back is greyed and does nothing GIVEN the backing already nets 0.00

WHEN press Set -> the pad closes AND the edit's Your backing row reads the backing after AND the footer's count stays as it was AND NEVER anything is signed before Sign the edit

WHEN press Set GIVEN the pick reads 0.00 -> the pad closes AND the edit's record carries 0.00 AND NEVER a record is added to the batch AND NEVER a dialog opens

WHEN press Cancel -> the pad closes AND nothing is staged AND the edit's pick is what it was

WHEN press the scrim outside the pad, press the system's Back or press Escape -> the pad closes AND nothing is staged AND the edit's pick is what it was

WHEN tap the pad's ? -> the pad's own help opens as a dialog over the edit AND NEVER the pad's body is replaced in place
