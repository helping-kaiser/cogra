# ComposeCrop · `spec:design:behavior-compose-crop`

ALWAYS one shape holds for every picture in the post

WHEN tap a shape chip -> every picture in the post takes that shape

WHEN drag inside the crop viewport -> the framed picture moves within the shape

WHEN pinch inside the crop viewport -> the framed picture zooms within the shape AND the zoom slider follows

WHEN tap a picture in the strip -> that picture takes the crop viewport for its own framing AND every other picture keeps the framing it was given

WHEN press Next GIVEN the crop was entered from compose's pick step -> the details stage opens AND the pictures' cropped exports start uploading AND NEVER an uncropped picture leaves the device

WHEN press Next GIVEN the crop was entered from an edit -> the edit comes back with the pictures on its media row AND the pictures' cropped exports start uploading AND NEVER an uncropped picture leaves the device AND NEVER a pick stage opens

WHEN the crop is reached by adding pictures to a published post's edit -> the crop is locked to the post's one shape

WHEN press the header back arrow GIVEN the crop was entered from compose's pick step -> the pick step comes back AND the picks are kept

WHEN press the header back arrow GIVEN the crop was entered from an edit -> the edit comes back as it was left AND the pictures go unused AND NEVER a pick stage opens

WHEN press the header X GIVEN the crop was entered from compose's pick step -> the whole flow is left AND the draft is kept AND NEVER a dialog asks

WHEN press the header X GIVEN the crop was entered from an edit -> the edit is left AND the draft is kept AND NEVER a dialog asks

ALWAYS the zoom slider stands under the crop on both platforms, its thumb at the crop's zoom between the fill and about 4×

WHEN move the zoom slider -> the picture zooms in place AND NEVER below the fill or past about 4×

WHEN press an arrow key GIVEN the crop has focus -> the picture moves 1 % that way AND NEVER past where its edge meets the crop's

WHEN press an arrow key with Shift held GIVEN the crop has focus -> the picture moves 10 % that way AND NEVER past where its edge meets the crop's

ALWAYS the line under the zoom slider reads One shape for the whole post. Drag to move, pinch to zoom.

ALWAYS the line's second sentence reads Drag or use the arrow keys to move, the slider to zoom. GIVEN a device with no touch to pinch
