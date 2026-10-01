# Feed · `spec:design:behavior-feed`

ALWAYS at most one clip plays on the feed

ALWAYS the playing clip keeps the stage GIVEN it still qualifies and the scroll has not settled at the feed's hard top

WHEN a second clip scrolls into view GIVEN the incumbent still qualifies -> NEVER the stage changes hands

WHEN the incumbent falls below the 70% gate GIVEN another clip qualifies -> the topmost qualifying clip takes the stage in the same moment AND the outgoing clip freezes on the frame it reached AND NEVER the handover waits for the scroll to settle

WHEN the incumbent falls below the 70% gate GIVEN no other clip qualifies -> the outgoing clip freezes on the frame it reached AND NEVER a clip plays

WHEN a clip starts to qualify GIVEN the stage is empty -> the topmost qualifying clip takes the stage

WHEN scroll settles at the feed's hard top GIVEN a qualifying clip exists -> the stage re-elects to the first qualifying clip in feed order

WHEN an overscroll bounce settles back at the feed's hard top GIVEN a qualifying clip exists -> the stage re-elects to the first qualifying clip in feed order

WHEN scroll settles anywhere below the hard top GIVEN the incumbent still qualifies -> NEVER the stage re-elects upward

WHEN a sheet opens over the feed -> the incumbent stops

ALWAYS no clip on the feed plays GIVEN a sheet covers the feed

WHEN the sheet over the feed dismisses GIVEN a clip qualifies -> the topmost qualifying clip takes the stage

ALWAYS a veiled clip has no playback and no sound-disc presence

WHEN a veiled clip unveils GIVEN the incumbent still qualifies -> NEVER the stage changes hands

WHEN a veiled clip unveils GIVEN the stage is empty -> the topmost qualifying clip takes the stage

WHEN a press-and-hold on feed.card.actionRow.stance.anchor signs -> feed.card.actionRow.stance.anchor refuses a second press-and-hold until the signing answers AND NEVER feed.card.actionRow.stance.anchor.face moves before the signature is taken

WHEN the hold's signing has not answered 200ms after the hold -> the line under feed.card.actionRow.stance.anchor.face reads Signing… AND NEVER a spinner appears

WHEN the hold's signing answers within 200ms of the hold -> NEVER the line Signing… appears

WHEN the hold's signing is taken -> feed.card.actionRow.stance.anchor.face moves to the new opinion AND the snackbar confirms the signature

WHEN the hold's signing does not go through -> feed.card.actionRow.stance.anchor.face stays where it was AND the line under it reads That didn't sign. followed by Retry AND NEVER the snackbar carries the failure

WHEN the hold's signing is refused by the write rule -> feed.card.actionRow.stance.anchor.face stays where it was AND the line under it reads You can't sign right now. AND NEVER Retry appears AND NEVER the line takes the failure voice

WHEN a read-side comfort on a card does not go through -> the comfort reverts AND the line under feed.card.actionRow.stance.anchor.face reads That didn't go through. followed by Retry AND NEVER the snackbar carries the failure

WHEN the feed arrives after a cold app open GIVEN a release newer than the running version exists and this device has not announced it -> the snackbar reads A newer version of CoGra is out. with What's new AND this device marks that release announced

WHEN the feed arrives GIVEN this device already announced the newest release -> NEVER the newer-version snackbar appears

WHEN the newer-version snackbar's What's new is pressed -> What's new opens with the line A newer version exists. atop the list
