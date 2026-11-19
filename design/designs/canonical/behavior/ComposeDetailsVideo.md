# ComposeDetailsVideo · `spec:design:behavior-compose-details-video`

ALWAYS the clip's tile wears the clip's frame 0 as its face

ALWAYS the clip's tile is 54 by 96 whatever the clip's shape, a wide or square clip's frame filling it cropped to it

ALWAYS the cover's tile stands beside the clip's at the clip tile's 96 high and, a cover chosen, at the cover's own shape, a tall clip's 4:5, a square clip's 1:1, a wide clip's 16:9

ALWAYS the cover's tile shows the chosen cover wearing the Cover pill, and is named Change the cover, GIVEN a cover was chosen

ALWAYS the cover's tile is the dashed Add a cover door, a square at the clip tile's height, 96 × 96, GIVEN no cover was chosen, whether the clip skipped the cover step or passed it without a pick

WHEN tap the cover's tile GIVEN a cover was chosen -> the cover step opens with the chosen cover still chosen AND its Next comes back to this stage with the choice

ALWAYS the clip carries no Show all and no manager

ALWAYS the describe row offers one description for the whole clip and none for its cover

WHEN the clip skips the cover step -> the device extracts the clip's frame 0 without a step AND uploads it as the clip's still

WHEN the frame 0 extraction fails -> the post goes without a still AND NEVER the post waits on a frame

WHEN tap Add a cover -> the cover step opens AND its Next comes back to this stage with the choice

WHEN tap Add a cover GIVEN the device returned no frames -> the cover step opens with the gallery alone

WHEN tap the clip's remove control -> the clip leaves AND the pick step comes back taking picks again

WHEN typing passes the title's 100 characters -> the count reads N over in the error colour AND the line A title is at most 100 characters. takes the hint's place AND Next goes inert

WHEN typing passes the description's 500 characters -> the count reads N over in the error colour AND the line A description is at most 500 characters. takes the hint's place AND Next goes inert

WHEN press Next GIVEN the clip is still going up -> the seal opens gated on the upload

WHEN press Next GIVEN the clip has landed -> the seal opens ungated

WHEN press the header back arrow GIVEN the clip skipped the cover step -> the pick step comes back with the clip staged

WHEN press the header back arrow GIVEN the clip came through the cover step -> the cover step comes back with its choice
WHEN press the header X -> the whole flow is left for where the composer was opened from AND the draft is kept AND NEVER a dialog asks
