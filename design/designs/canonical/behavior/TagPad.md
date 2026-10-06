# TagPad · `spec:design:behavior-tag-pad`

ALWAYS the edit beneath the sheet stays inert while the sheet is up

ALWAYS the sheet is titled by the tag it edits

ALWAYS the pick's readout stands above the field

ALWAYS relevance runs across the field from +0.01 to 1 and confidence up it from 0 to 1

ALWAYS the readout shows the nearest of the tag's thirteen anchors beside the exact pair, never a stance face

ALWAYS the line over the foot reads Signed with the post, as its own action. GIVEN the sheet was opened from the post edit

ALWAYS the line over the foot reads Signed with the comment, as its own action. GIVEN the sheet was opened from the comment edit

ALWAYS the sheet stands over the edit it was opened from, the post edit or the comment edit

ALWAYS the sheet opened from the comment edit differs from the sheet opened from the post edit only in the noun of the line over the foot

WHEN drag on the field -> the pair follows the drag AND NEVER relevance goes below +0.01 AND NEVER anything signs

ALWAYS the non-drag route Set exact values for and the tag's name stands beside the field, hidden until focused, and leads to the same pick by sliders or typed values

WHEN press the non-drag route -> the field gives way in place to the two tracks with the tag's bound and poles AND Type exact values stands one tap away AND the readout and Done stay

WHEN press Un-tag -> the sheet closes AND the tag's withdrawal is staged in the edit's batch AND the chip leaves the row for the line Withdrawn: AND the acts count one more AND NEVER a dialog asks

WHEN press Done -> the sheet closes AND the chip carries the pair it was given

WHEN tap the scrim -> the sheet closes AND the pair is what it was before the sheet opened AND NEVER anything staged in the sheet applies

WHEN swipe the sheet down, press system Back or press Escape -> the sheet closes AND the pair is what it was before the sheet opened AND NEVER anything staged in the sheet applies
