# KeptPicksReview · `spec:design:behavior-kept-picks-review`

ALWAYS a kept pick is signed only from the review's own seal, together with every other pick still in the review

WHEN the key is restored GIVEN picks are kept pending on this device -> the kept picks' review opens AND NEVER a kept pick is signed

WHEN tap the remove control of a kept pick GIVEN more than one pick is in the review -> the pick is dropped from this device AND its row leaves the review AND NEVER a confirmation is asked AND NEVER an undo is offered

WHEN tap the remove control of a kept pick GIVEN it is the last pick in the review -> the pick is dropped from this device AND the review closes to where it was opened from AND the snackbar reads Nothing left to sign.

WHEN tap Sign them -> the seal opens with every pick in the review as its acts AND NEVER a pick is signed

WHEN press the header back -> the review closes to where it was opened from AND NEVER a pick is signed AND NEVER a pick is dropped
