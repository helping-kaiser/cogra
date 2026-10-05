# PadStanding · `spec:design:behavior-pad-standing`

WHEN tap a stance face GIVEN the reader already has an opinion standing on the target -> the pad blooms at the lower centre of the viewport AND NEVER anything is staged

ALWAYS the pad parks at the same spot every time, 16px above the bottom bar where the surface has one and 16px off the bottom edge where it does not, never anchored to the target

ALWAYS the surface beneath the pad's wash stays inert while the pad is up

ALWAYS the pad is modal for assistive tech: focus moves into it on open, stays inside while it is up, and returns to the face that opened it on close

ALWAYS the pad reads Current opinion and Your pick above the field and Resulting opinion below it, each a label over its own face and pair, never merged into one line

ALWAYS the pad carries four controls, Walk it back on the left pushed away from Cancel and Set on the right, GIVEN an opinion stands on the target

ALWAYS the pad carries no Walk it back GIVEN nothing was ever signed toward the target

WHEN drag on the pad field -> the knob and the pick's face and pair follow the drag AND the landing line reads what the pick would come to AND NEVER anything is staged

WHEN release a drag on the pad field -> the pick is parked AND the knob's pressed layer lifts AND NEVER anything is signed

ALWAYS the knob never leaves the field, whose corners are the bounds of both axes

WHEN tap Walk it back -> the dialog Walk it all back? opens AND NEVER the dialog carries a pick line

WHEN tap Cancel -> the pad closes AND nothing is staged AND the standing opinion is what it was

WHEN press outside the pad, press the system's Back or press Escape -> the pad closes AND nothing is staged AND the standing opinion is what it was

WHEN tap the pad's ? -> the opinions help opens AND NEVER anything is staged

WHEN tap Set -> Set refuses a second press until the signing answers AND the pad stays open AND NEVER Set dims

WHEN the signing has not answered 200ms after Set -> Set reads Setting… AND NEVER a spinner appears

WHEN the signing answers within 200ms of Set -> NEVER Set reads Setting…

WHEN the signing is taken -> the pad closes back where it bloomed AND the face on the target moves to the new opinion AND the snackbar reads Signed, still settling. with the current opinion's face and pair

WHEN tap Set GIVEN the pick nets the standing bundle to (0, 0) -> the dialog Walk it all back? opens with its cost and the pick line AND NEVER the pick is refused

WHEN tap Set GIVEN the signing key is not on this device -> the pad's notice Your key isn't on this browser stands where the landing line and the actions were AND NEVER anything is signed

WHEN the signing does not go through -> the pad stays open at the pick AND the line That didn't send. Try again. stands above the commit row AND an outlined Retry takes Set's slot

WHEN the write rule refuses the signing -> the pad stays open at the pick AND the notice You can't sign right now stands where the landing line and the commit row were, with Not now AND nothing is staged or spent

ALWAYS the non-drag route Choose your opinion on this post stands beside the face, hidden until focused, and leads to the same pick by sliders or typed values

WHEN a pointer goes down on the pad field -> the knob wears a 40px pressed layer in its own colour at 10% for as long as the pointer stays down AND NEVER the knob scales

WHEN the knob crosses a zero line or meets the field's edge where the pick clamps GIVEN the device is Android -> the platform's one tick is given AND NEVER anything else in the drag vibrates

WHEN the pick changes -> the readouts redraw at once AND NEVER the spoken readouts change before the pick has rested 500ms

WHEN the pick has rested 500ms -> the spoken readouts say the pick and the landing once
