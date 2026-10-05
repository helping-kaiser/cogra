# KeptPicksReview · `spec:design:behavior-kept-picks-review`

ALWAYS a kept pick is signed only from the review's own seal, together with every other pick still in the review

ALWAYS the review lists plain opinions only

ALWAYS a kept vouch-back or approval never joins the review

ALWAYS a kept pick whose target was removed or redacted keeps its row, wearing the removed-mark face in place of a live preview, and still signs

ALWAYS a kept pick that would net its bundle to nothing states that consequence on its own row

WHEN the key is restored GIVEN picks are kept pending on this device -> the kept picks' review opens AND NEVER a kept pick is signed

WHEN tap the remove control of a kept pick GIVEN more than one pick is in the review -> the pick is dropped from this device AND its row leaves the review AND the drop is announced as Removed — N picks left. AND focus moves to the next row AND NEVER a confirmation is asked AND NEVER an undo is offered

WHEN tap the remove control of a kept pick GIVEN it is the last pick in the review -> the pick is dropped from this device AND the review closes to where it was opened from AND the snackbar reads Nothing left to sign.

WHEN tap Sign them -> the seal opens with every pick in the review as its acts AND NEVER a pick is signed

WHEN press Sign the opinions GIVEN a pick in the batch would net its bundle to nothing -> the batch signs AND NEVER a severance confirmation is asked

WHEN the write rule refuses the batch -> the notice's fact ends your picks are still kept. AND its way out reads Not now AND NEVER a pick is dropped

WHEN tap Not now on the write rule's notice GIVEN it was reached from the review's seal -> the review stands again with every pick still in it

WHEN press the header back -> the review closes to where it was opened from AND NEVER a pick is signed AND NEVER a pick is dropped

ALWAYS each kept pick's anchor reads Waiting for your review GIVEN the key is on this device and the review was left unsigned

WHEN tap a kept pick's anchor GIVEN the key is on this device -> the kept picks' review opens AND NEVER the key notice opens

ALWAYS the settings row that reopens the review shows only GIVEN the key is on this device and unsigned kept picks wait

WHEN the key leaves this device again GIVEN kept picks wait unsigned -> the settings row that reopens the review goes AND each kept pick's anchor reads Waiting for your key

ALWAYS one quiet line under the intro reads An approval waits on Invites — it signs on its own there. with Open Invites at its end GIVEN an approval was kept with the picks

ALWAYS no line about an approval stands GIVEN no approval was kept

WHEN tap Open Invites -> Invites opens, where the kept approval waits as its own card and signs through the approval pad AND every pick stays kept AND NEVER the approval joins the batch
