# Feed · `spec:design:behavior-feed`

ALWAYS at most one clip plays on the feed

ALWAYS feed.card.media.frame competes for the feed's one stage GIVEN it holds a clip

ALWAYS feed.commentCard.media.frame competes for the same stage as feed.card.media.frame GIVEN it holds a clip

ALWAYS the playing clip keeps the stage GIVEN it still qualifies and the scroll has not settled at the feed's hard top

WHEN a second clip scrolls into view GIVEN the incumbent still qualifies -> NEVER the stage changes hands

WHEN the incumbent falls below the 70% gate GIVEN another clip qualifies and the device allows autoplay -> the topmost qualifying clip takes the stage in the same moment AND the outgoing clip freezes on the frame it reached AND NEVER the handover waits for the scroll to settle

WHEN the incumbent falls below the 70% gate GIVEN no other clip qualifies or the device suppresses autoplay -> the outgoing clip freezes on the frame it reached AND NEVER a clip plays

WHEN a clip starts to qualify GIVEN the stage is empty and the device allows autoplay -> the topmost qualifying clip takes the stage

WHEN scroll settles at the feed's hard top GIVEN a qualifying clip exists and the device allows autoplay -> the stage re-elects to the first qualifying clip in feed order

WHEN an overscroll bounce settles back at the feed's hard top GIVEN a qualifying clip exists and the device allows autoplay -> the stage re-elects to the first qualifying clip in feed order

ALWAYS a clip the reader started by its play disc keeps the stage GIVEN it still qualifies, at the feed's hard top included

ALWAYS a clip the reader started by its play disc below the 70% gate keeps the stage while any of it stands on screen GIVEN it has not qualified since the tap

WHEN a clip the reader started by its play disc below the 70% gate leaves the screen GIVEN it has not qualified since the tap -> it freezes on the frame it reached AND the stage law's ordinary succession takes over

WHEN scroll settles anywhere below the hard top GIVEN the incumbent still qualifies -> NEVER the stage re-elects upward

WHEN a sheet or a dialog opens over the feed -> the incumbent stops

ALWAYS no clip on the feed plays GIVEN a sheet or a dialog covers the feed

WHEN the sheet or the dialog over the feed dismisses GIVEN a clip qualifies and the device allows autoplay -> the topmost qualifying clip takes the stage

WHEN the sheet or the dialog over the feed dismisses GIVEN the device suppresses autoplay -> NEVER a clip plays AND a clip the reader had started by its play disc stands on the frame it reached, wearing its play disc again

WHEN the opinion pad opens over the feed -> the playing clip pauses on the frame it reached AND NEVER the stage changes hands

WHEN the opinion pad over the feed closes GIVEN it paused a clip, under suppressed autoplay included -> that same clip resumes from the frame it reached AND NEVER the stage re-elects

ALWAYS a veiled clip has no playback and no sound-disc presence

ALWAYS feed.card.media.frame.soundDisc is absent GIVEN feed.card.media.frame's clip is veiled

WHEN a veiled clip unveils GIVEN the incumbent still qualifies -> NEVER the stage changes hands

WHEN a veiled clip unveils GIVEN the stage is empty and the device allows autoplay -> the topmost qualifying clip takes the stage

WHEN the page is hidden, a backgrounded app and a locked screen included -> the playing clip pauses on the frame it reached

WHEN the hidden page shows again GIVEN a clip was playing when it hid and the device allows autoplay -> that clip resumes from the frame it reached AND NEVER the stage re-elects

WHEN the hidden page shows again GIVEN the device suppresses autoplay -> NEVER a clip plays AND the clip that was playing stands frozen on the frame it reached, wearing its play disc

WHEN a press-and-hold on feed.card.actionRow.stance.anchor signs -> feed.card.actionRow.stance.anchor refuses a second press-and-hold until the signing answers AND NEVER feed.card.actionRow.stance.anchor.face moves before the signature is taken

WHEN the hold's signing has not answered 200ms after the hold -> the line under feed.card.actionRow.stance.anchor.face reads Signing… AND NEVER a spinner appears

WHEN the hold's signing answers within 200ms of the hold -> NEVER the line Signing… appears

WHEN the hold's signing is taken -> feed.card.actionRow.stance.anchor.face moves to the new opinion AND the snackbar confirms the signature

WHEN the hold's signing does not go through -> feed.card.actionRow.stance.anchor.face stays where it was AND the line under it reads That didn't sign. followed by Retry AND NEVER the snackbar carries the failure

WHEN the hold's signing is refused by the write rule -> feed.card.actionRow.stance.anchor.face stays where it was AND the line under it reads You can't sign right now. AND NEVER Retry appears AND NEVER the line takes the failure voice

WHEN a read-side comfort on a card does not go through -> the comfort reverts AND the line under feed.card.actionRow.stance.anchor.face reads That didn't go through. followed by Retry AND NEVER the snackbar carries the failure

WHEN the feed arrives after a cold app open GIVEN a release newer than the running version exists and this device has not announced it -> the snackbar reads A newer version of CoGra is out. with Update now AND this device marks that release announced

WHEN the feed arrives GIVEN this device already announced the newest release -> NEVER the newer-version snackbar appears

WHEN the newer-version snackbar's Update now is pressed GIVEN the app -> CoGra's Play Store listing opens

WHEN the newer-version snackbar's Update now is pressed GIVEN the web -> the page reloads into the new version

WHEN the newer-version snackbar's Update now is pressed -> NEVER a page of the code repository opens

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
