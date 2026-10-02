# ComposePickVideo · `spec:design:behavior-compose-pick-video`

ALWAYS the grid takes no picks and the way out to the photos app is gone GIVEN a clip is staged

ALWAYS the tray carries no Show all GIVEN a clip is staged

ALWAYS the tray's line reads A video is the whole post. Its cover comes next. GIVEN the clip is horizontal or square

ALWAYS the tray's line reads A video is the whole post. GIVEN the clip is vertical

ALWAYS the clip's tile wears the clip's frame 0 as its face

WHEN tap the clip's remove control -> the clip leaves AND the step takes picks again

WHEN press Next GIVEN the clip is horizontal or square -> the cover step opens AND NEVER the crop opens

WHEN press Next GIVEN the clip is vertical -> the details stage opens with its Add a cover door AND NEVER the cover step opens

WHEN press Next -> NEVER the clip's length decides whether the cover step comes next

WHEN press the header back arrow -> the wizard leaves toward where compose began AND the draft is kept AND NEVER a dialog asks

WHEN press the header X -> the whole flow is left AND the draft is kept AND NEVER a dialog asks

WHEN tap Write words instead GIVEN the body holds pictures or a clip -> an ask to discard the body opens over the stage AND NEVER the body switches before the ask is answered

WHEN tap Write words instead GIVEN the body is empty -> the words stage opens AND NEVER an ask opens
