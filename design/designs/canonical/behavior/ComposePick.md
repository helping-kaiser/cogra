# ComposePick · `spec:design:behavior-compose-pick`

ALWAYS the device grid stands newest first

ALWAYS the first picture in the tray is the cover

WHEN tap an unpicked picture tile in the grid GIVEN the tray holds fewer than ten pictures and no video -> the picture is picked AND its tile's ring shows its place in the post

WHEN tap a picked picture tile in the grid -> the pick is undone AND the picture leaves the tray

WHEN tap the first tile, Your photos app -> the device's own photos app opens AND what is picked there lands in the tray

WHEN drag a tray thumbnail to a new place -> the tray takes the new order AND the picture now first in the tray is the cover

WHEN tap a tray thumbnail's remove control -> the picture leaves the tray

WHEN tap a video tile GIVEN nothing is in the tray -> the video becomes the whole body AND the step stops taking picks

WHEN a picked file breaks a cap or is in a format nothing here reads -> the step says why in a line on its media row AND NEVER a dialog opens AND NEVER a snackbar carries the refusal

WHEN a picked file is judged -> its size and format answer first AND the body's grammar answers second AND one refused file reads one line

WHEN a video is picked GIVEN pictures are in the tray -> the video is refused with A post carries pictures or one video, not both. AND the pictures stay in the tray

WHEN a fresh batch of pictures and a video is picked GIVEN nothing is in the tray -> the pictures are kept AND the video is refused with A post carries pictures or one video, not both.

WHEN an eleventh picture is picked -> it is refused with That's more than a post carries — up to ten pictures. AND NEVER a picture is dropped in silence

WHEN a picture is picked -> NEVER the picture uploads before the crop

WHEN press Next GIVEN the body is one video -> NEVER the clip's length decides whether the cover step comes next

WHEN press the header back arrow -> the wizard leaves toward where compose began AND the draft is kept AND NEVER a dialog asks

WHEN make the platform back gesture -> the wizard leaves toward where compose began AND the draft is kept AND NEVER a dialog asks

WHEN press the header X -> the whole flow is left AND the draft is kept AND NEVER a dialog asks

ALWAYS a reference brought by Cite in a new post or Mention in a new post rides the draft unseen until the details stage
