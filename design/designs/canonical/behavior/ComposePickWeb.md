# ComposePickWeb · `spec:design:behavior-compose-pick-web`

ALWAYS the pick step in a browser draws no device grid, one region with Choose from your files and a drop target in its place

ALWAYS the first picture in the tray is the cover

WHEN press Choose from your files -> the browser's own file dialog opens AND what is chosen there lands in the tray

WHEN files are dropped on the region -> the dropped files land in the tray

WHEN a video is chosen or dropped GIVEN nothing is in the tray -> the video becomes the whole body AND the step stops taking picks

WHEN a chosen or dropped file breaks a cap or is in a format nothing here reads -> the step says why in a line on its media row AND NEVER a dialog opens AND NEVER a snackbar carries the refusal

WHEN tap a tray thumbnail's remove control -> the picture leaves the tray

WHEN a picture is chosen or dropped -> NEVER the picture uploads before the crop

WHEN press Next GIVEN the body is one video -> NEVER the clip's length decides whether the cover step comes next

WHEN press the header back arrow -> the wizard leaves toward where compose began AND the draft is kept AND NEVER a dialog asks

WHEN press the header X -> the whole flow is left AND the draft is kept AND NEVER a dialog asks

WHEN tap Write words instead GIVEN the body holds pictures or a clip -> an ask to discard the body opens over the stage AND NEVER the body switches before the ask is answered

WHEN tap Write words instead GIVEN the body is empty -> the words stage opens AND NEVER an ask opens
