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
