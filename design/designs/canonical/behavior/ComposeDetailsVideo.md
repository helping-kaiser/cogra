# ComposeDetailsVideo · `spec:design:behavior-compose-details-video`

ALWAYS the clip's tile wears the clip's frame 0 as its face

ALWAYS the stage carries the Add a cover door GIVEN the clip skipped the cover step

ALWAYS the stage carries no cover section GIVEN the clip came through the cover step

ALWAYS the clip carries no Show all and no manager

ALWAYS the describe row offers one description for the whole clip and none for its cover

WHEN the clip skips the cover step -> the device extracts the clip's frame 0 without a step AND uploads it as the clip's still

WHEN the frame 0 extraction fails -> the post goes without a still AND NEVER the post waits on a frame

WHEN tap Add a cover -> the cover step opens AND its Next comes back to this stage

WHEN tap Add a cover GIVEN the device returned no frames -> the cover step opens with the gallery alone

WHEN tap the clip's remove control -> the clip leaves AND the pick step comes back taking picks again

WHEN typing passes the title's 100 characters -> the count reads N over in the error colour AND the line A title is at most 100 characters. takes the hint's place AND Next goes inert

WHEN typing passes the description's 500 characters -> the count reads N over in the error colour AND the line A description is at most 500 characters. takes the hint's place AND Next goes inert

WHEN press Next GIVEN the clip is still going up -> the seal opens gated on the upload

WHEN press Next GIVEN the clip has landed -> the seal opens ungated

WHEN press the header back arrow GIVEN the clip skipped the cover step -> the pick step comes back with the clip staged

WHEN press the header back arrow GIVEN the clip came through the cover step -> the cover step comes back with its choice

WHEN press the header X -> the whole flow is left AND the draft is kept AND NEVER a dialog asks
