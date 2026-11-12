# ComposeCrop · `spec:design:behavior-compose-crop`

ALWAYS one shape holds for every picture in the post

ALWAYS the crop's frame stands still at the chosen shape, and the picture is what moves and zooms under it, on both platforms

ALWAYS the crop's stage stands 390 × 488 under every shape, the frame inside it at the stage's full width and centred in its height

ALWAYS the frame stands 390 × 488, filling the stage, GIVEN the shape is Tall 4:5

ALWAYS the frame stands 390 × 390, 49 below the stage's top, GIVEN the shape is Square 1:1

ALWAYS the frame stands 390 × 204, 142 below the stage's top, GIVEN the shape is Wide 1.91:1

ALWAYS the picture outside the frame stays in view under a 45 % black, and the frame carries the rule-of-thirds guides

WHEN tap a shape chip -> every picture in the post takes that shape

WHEN tap a shape chip -> each picture keeps its scale and its position AND the shape's frame changes around it AND NEVER the picture shrinks to fit the new frame AND NEVER the stage changes size

WHEN tap a shape chip GIVEN a picture's scale would stand below the new shape's fill -> that picture's scale rises to the fill, the zoom slider's floor, and no further

WHEN tap a shape chip GIVEN a picture's edge would stand inside the new shape's frame -> that picture shifts just enough that its edge meets the frame's AND NEVER further

WHEN drag inside the crop viewport -> the picture moves under the frame AND NEVER the frame moves AND NEVER an edge of the picture comes inside the frame

WHEN pinch inside the crop viewport -> the picture zooms under the frame AND the zoom slider follows AND NEVER the frame changes size

WHEN tap a picture in the strip -> that picture takes the crop viewport for its own framing AND every other picture keeps the framing it was given

WHEN press Next GIVEN the crop was entered from compose's pick step -> the details stage opens AND the pictures' cropped exports start uploading AND NEVER an uncropped picture leaves the device

WHEN press Next GIVEN the crop was entered from an edit -> the edit comes back with the pictures on its media row AND the pictures' cropped exports start uploading AND NEVER an uncropped picture leaves the device AND NEVER a pick stage opens

WHEN the crop is reached by adding pictures to a published post's edit -> the crop is locked to the post's one shape

WHEN press the header back arrow GIVEN the crop was entered from compose's pick step -> the pick step comes back AND the picks are kept

WHEN press the header back arrow GIVEN the crop was entered from an edit -> the edit comes back as it was left AND the pictures go unused AND NEVER a pick stage opens

WHEN press the header X GIVEN the crop was entered from compose's pick step -> the whole flow is left for where the composer was opened from AND the draft is kept AND NEVER a dialog asks

WHEN press the header X GIVEN the crop was entered from an edit -> DiscardConfirm opens, as the edit's own X raises it AND NEVER the edit is discarded before the dialog is answered

ALWAYS the zoom slider stands under the crop on both platforms, its thumb at the crop's zoom between the fill and about 4×

WHEN move the zoom slider -> the picture zooms in place AND NEVER below the fill or past about 4×

WHEN press an arrow key GIVEN the crop has focus -> the picture moves 1 % that way AND NEVER past where its edge meets the crop's

WHEN press an arrow key with Shift held GIVEN the crop has focus -> the picture moves 10 % that way AND NEVER past where its edge meets the crop's

ALWAYS the line under the zoom slider reads One shape for the whole post.
