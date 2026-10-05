# CoverCrop · `spec:design:behavior-cover-crop`

ALWAYS the crop's shape is locked to the clip's display shape, the clip's own ratio in a post and the comment's square in a comment

ALWAYS the crop offers no shape chips

WHEN drag inside the crop viewport -> the picture moves within the locked shape

WHEN pinch inside the crop viewport -> the picture zooms within the locked shape AND the zoom slider follows

WHEN press Next -> the cover is set AND the step that asked for it comes back AND only the cropped export leaves the device

WHEN press the header back arrow -> the step that asked for the cover comes back AND the picture goes unused

WHEN press the header X -> the whole flow is left AND the draft is kept AND NEVER a dialog asks

ALWAYS the zoom slider stands under the crop on both platforms, its thumb at the crop's zoom between the fill and about 4×

WHEN move the zoom slider -> the picture zooms in place AND NEVER below the fill or past about 4×

WHEN press an arrow key GIVEN the crop has focus -> the picture moves one step that way AND NEVER past where its edge meets the crop's
