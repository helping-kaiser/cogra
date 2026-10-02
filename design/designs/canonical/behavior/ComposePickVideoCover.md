# ComposePickVideoCover · `spec:design:behavior-compose-pick-video-cover`

WHEN the pick step is reached back from the cover step GIVEN a cover was chosen -> the clip's tile wears the chosen cover inset in its bottom-left corner AND the choice is kept

ALWAYS the clip's tile wears the clip's frame 0 as its face and the chosen cover only as the inset

ALWAYS the clip and its cover stand as one tile, never as two

ALWAYS the grid takes no picks GIVEN a clip is staged

WHEN tap the clip's remove control -> the clip leaves AND its cover goes with it AND the step takes picks again

WHEN press Next -> the cover step opens with the chosen cover still chosen AND NEVER the step asks for it afresh

WHEN press the header back arrow -> the wizard leaves toward where compose began AND the draft is kept AND NEVER a dialog asks

WHEN press the header X -> the whole flow is left AND the draft is kept AND NEVER a dialog asks

WHEN tap Write words instead GIVEN the body holds pictures or a clip -> an ask to discard the body opens over the stage AND NEVER the body switches before the ask is answered

WHEN tap Write words instead GIVEN the body is empty -> the words stage opens AND NEVER an ask opens
