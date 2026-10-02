# Feed · `spec:design:behavior-feed`

ALWAYS at most one clip plays on the feed

ALWAYS feed.card.media.frame competes for the feed's one stage GIVEN it holds a clip

ALWAYS a comment card's clip competes for the same stage as feed.card.media.frame

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

ALWAYS feed.card.media.frame.soundDisc is absent GIVEN feed.card.media.frame's clip is veiled

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

WHEN tap feed.bottomBar.feedSlot GIVEN another tab is showing and the feed was opened this session -> the feed comes back in the state it was left, its whole stack and its scroll AND NEVER the feed reloads

WHEN tap feed.bottomBar.feedSlot GIVEN another tab is showing and the feed was not opened this session -> the feed arrives at its root, fresh

WHEN tap feed.bottomBar.feedSlot GIVEN a screen deeper in the feed's stack is showing -> the feed's root comes back at the scroll it was left AND NEVER the feed reloads

WHEN tap feed.bottomBar.feedSlot GIVEN the feed's root stands at its top -> the feed refreshes and loads what is new AND the platform's own refresh indicator shows

WHEN pull down GIVEN the feed's root stands all the way at its top -> the feed refreshes and loads what is new AND the platform's own refresh indicator shows

ALWAYS the feed refreshes only on the tap of feed.bottomBar.feedSlot at its top or on a pull down all the way at its top

ALWAYS the system draws no refresh indicator of its own

WHEN the reader comes back to the feed -> the list stands as it was left AND NEVER the feed reloads

WHEN the reader comes back to the feed GIVEN a sheet or a dialog was up over it when they left -> the feed's screen and scroll stand AND NEVER the sheet or the dialog stands

WHEN the app cold-launches -> the feed's root arrives fresh

WHEN press Android Back GIVEN the feed's root is showing -> the app leaves
