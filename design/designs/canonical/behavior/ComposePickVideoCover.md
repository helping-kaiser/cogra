# ComposePickVideoCover · `spec:design:behavior-compose-pick-video-cover`

WHEN the pick step is reached back from the cover step GIVEN a cover was chosen -> the chosen cover stands as its own tile beside the clip's AND the choice is kept

ALWAYS the clip's tile wears the clip's frame 0 as its face

ALWAYS the cover's tile stands beside the clip's at the clip tile's height and at the cover's own shape, a tall clip's 4:5, a square clip's 1:1, a wide clip's 16:9, wearing the Cover pill

ALWAYS the cover's tile is named Change the cover

WHEN tap the cover's tile -> the cover step opens with the chosen cover still chosen AND NEVER the step asks for it afresh

ALWAYS the grid takes no picks GIVEN a clip is staged

WHEN tap the clip's remove control -> the clip leaves AND its cover goes with it AND the step takes picks again

WHEN press Next -> the cover step opens with the chosen cover still chosen AND NEVER the step asks for it afresh

ALWAYS the header back arrow is named Back, never Back a step

WHEN press the header back arrow -> the wizard leaves for where the composer was opened from AND the draft is kept AND NEVER a dialog asks

WHEN press the header X -> the whole flow is left for where the composer was opened from AND the draft is kept AND NEVER a dialog asks

WHEN tap Write words instead GIVEN the body holds pictures or a clip -> an ask to discard the body opens over the stage AND NEVER the body switches before the ask is answered

WHEN tap Write words instead GIVEN the body is empty -> the words stage opens AND NEVER an ask opens
