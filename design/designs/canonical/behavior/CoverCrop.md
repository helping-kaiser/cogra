# CoverCrop · `spec:design:behavior-cover-crop`

ALWAYS the crop's shape is locked to the clip's display shape, the clip's own ratio in a post and the comment's square in a comment

ALWAYS the crop offers no shape chips

WHEN drag inside the crop viewport -> the picture moves within the locked shape

WHEN pinch inside the crop viewport -> the picture zooms within the locked shape AND the zoom slider follows

WHEN press Next -> the cover is set AND the step that asked for it comes back AND only the cropped export leaves the device

WHEN press the header back arrow -> the step that asked for the cover comes back AND the picture goes unused

WHEN press the header X GIVEN the crop was entered from a post's compose or edit -> the whole flow is left AND the draft is kept AND NEVER a dialog asks

WHEN press the header X GIVEN the crop was entered from a reply's cover row -> DiscardConfirm opens, as the reply's own X raises it AND NEVER the reply is discarded before the dialog is answered

WHEN press the header X GIVEN the crop was entered from a comment edit's cover row -> DiscardConfirm opens, as the edit's own X raises it AND NEVER the edit is discarded before the dialog is answered

ALWAYS the zoom slider stands under the crop on both platforms, its thumb at the crop's zoom between the fill and about 4×

WHEN move the zoom slider -> the picture zooms in place AND NEVER below the fill or past about 4×

WHEN press an arrow key GIVEN the crop has focus -> the picture moves 1 % that way AND NEVER past where its edge meets the crop's

WHEN press an arrow key with Shift held GIVEN the crop has focus -> the picture moves 10 % that way AND NEVER past where its edge meets the crop's

ALWAYS the lines Drag to move, pinch to zoom. and The cover takes the video's shape. stand under the zoom slider

ALWAYS the line Drag to move, pinch to zoom. reads Drag or use the arrow keys to move, the slider to zoom. GIVEN a device with no touch to pinch
