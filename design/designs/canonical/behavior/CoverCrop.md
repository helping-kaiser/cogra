# CoverCrop · `spec:design:behavior-cover-crop`

ALWAYS the crop's frame has the clip's dimensions and never another, the shape the clip stands at in a card — its own ratio, a clip taller than 4:5 at 4:5 — in a post and the comment's square in a comment, tall clip a tall cover, square a square, wide a wide

ALWAYS the crop exports the frame's shape and only that shape, so the cover can never disagree with the clip it is the face of

ALWAYS the crop offers no shape chips

ALWAYS the crop's frame stands still at the locked shape, and the picture is what moves and zooms under it, on both platforms

ALWAYS the crop's stage stands 390 × 488 under every shape, the post crop's stage, the frame inside it 342 wide between the 24 gutters and centred in its height: 342 × 192 at 148 below the stage's top for a 16:9 clip, 342 × 427.5 at 30.25 for a tall clip's 4:5, 342 × 342 at 73 for a square clip and the comment's square

ALWAYS the picture outside the frame stays in view under a 45 % black

WHEN drag inside the crop viewport -> the picture moves under the frame AND NEVER the frame moves

WHEN pinch inside the crop viewport -> the picture zooms under the frame AND the zoom slider follows AND NEVER the frame changes size

WHEN press Next -> the cover is set AND the step that asked for it comes back AND only the cropped export leaves the device

WHEN press the header back arrow -> the step that asked for the cover comes back AND the picture goes unused

WHEN press the header X GIVEN the crop was entered from a post's compose -> the whole flow is left for where the composer was opened from AND the draft is kept AND NEVER a dialog asks

WHEN press the header X GIVEN the crop was entered from a post edit's cover row -> DiscardConfirm opens, as the edit's own X raises it AND NEVER the edit is discarded before the dialog is answered

WHEN press the header X GIVEN the crop was entered from a reply's cover row -> DiscardConfirm opens, as the reply's own X raises it AND NEVER the reply is discarded before the dialog is answered

WHEN press the header X GIVEN the crop was entered from a comment edit's cover row -> DiscardConfirm opens, as the edit's own X raises it AND NEVER the edit is discarded before the dialog is answered

ALWAYS the zoom slider stands under the crop on both platforms, its thumb at the crop's zoom between the fill and about 4×

WHEN move the zoom slider -> the picture zooms in place AND NEVER below the fill or past about 4×

WHEN press an arrow key GIVEN the crop has focus -> the picture moves 1 % that way AND NEVER past where its edge meets the crop's

WHEN press an arrow key with Shift held GIVEN the crop has focus -> the picture moves 10 % that way AND NEVER past where its edge meets the crop's
