# TagPad · `spec:design:behavior-tag-pad`

ALWAYS the edit beneath the sheet stays inert while the sheet is up

ALWAYS the sheet is titled by the tag it edits

ALWAYS the pick's readout stands above the field

ALWAYS relevance runs across the field from +0.01 to 1 and confidence up it from 0 to 1

ALWAYS the readout shows the nearest of the tag's thirteen anchors beside the exact pair, never a stance face

ALWAYS the line over the foot reads Signed with the post, as its own action. GIVEN the sheet was opened from the post edit

ALWAYS the line over the foot reads Signed with the comment, as its own action. GIVEN the sheet was opened from the comment edit

WHEN drag on the field -> the pair follows the drag AND NEVER relevance goes below +0.01 AND NEVER anything signs

WHEN press Un-tag -> the sheet closes AND the tag's withdrawal is staged in the edit's batch AND the chip leaves the row for the line Withdrawn: AND the acts count one more AND NEVER a dialog asks

WHEN press Done -> the sheet closes AND the chip carries the pair it was given

WHEN tap the scrim -> the sheet closes AND the pair is what it was before the sheet opened
