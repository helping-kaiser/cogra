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

WHEN press Next GIVEN the crop was entered from an edit -> the edit comes back with the pictures on its media row, its picture sheet over it where the crop was opened from the sheet, AND the cropped exports of the pictures added or re-framed in this visit start uploading AND NEVER an uncropped picture leaves the device AND NEVER a pick stage opens

ALWAYS the crop entered from a post's edit stands as the new post's crop, the shape row with the post's shape selected and all three chips live, the stage, the zoom slider, the line, the strip and Next

ALWAYS the strip holds every picture of the post in the edit's order, the pictures the post already carries and the ones just added, GIVEN the crop was entered from an edit

WHEN the crop is reached by adding pictures to a post's edit -> the strip holds the post's pictures and the new ones AND the first new picture takes the crop viewport

WHEN tap a picture's Crop in the edit's picture sheet -> the crop opens with that picture in the crop viewport AND the strip holds every picture of the post

ALWAYS a picture the post already carries is framed within its published cut-out, the only part of it that ever left the device, so it can be framed tighter and never wider

ALWAYS the zoom slider's floor is the published cut-out's fill of the current shape and its ceiling the post crop's one ceiling GIVEN the picture in the crop viewport is one the post already carries

ALWAYS a picture just added is framed within the picked original, as on the new post's crop

WHEN tap a shape chip GIVEN the crop was entered from an edit -> every picture in the post takes that shape, the pictures it already carries among them, each keeping its scale and its position, rising to the fill and shifting to meet the frame as on the new post's crop

ALWAYS a picture the post already carries whose framing and shape stand as published is not replaced, and one whose framing or shape changed is a replacement of that picture in the signed edit

ALWAYS a replaced picture rides the edit's own record, the post's new content state, as an added or a removed picture does, staging that record when nothing else has and adding no row and nothing to the count when it is already staged

WHEN press the header back arrow GIVEN the crop was entered from compose's pick step -> the pick step comes back AND the picks are kept

WHEN press the header back arrow GIVEN the crop was entered from an edit -> the edit comes back as it was before the crop opened, its picture sheet over it where the crop was opened from the sheet, AND every picture added and every framing or shape changed in this visit goes unused AND NEVER a pick stage opens

ALWAYS the header back arrow is named Back to the edit GIVEN the crop was entered from a post edit

ALWAYS the header X is named Leave — the edit is discarded GIVEN the crop was entered from a post edit

ALWAYS the header back arrow is named Back a step GIVEN the crop is a stage of the new post's wizard

WHEN press the header X GIVEN the crop was entered from compose's pick step -> the whole flow is left for where the composer was opened from AND the draft is kept AND NEVER a dialog asks

WHEN press the header X GIVEN the crop was entered from an edit -> DiscardConfirm opens, as the edit's own X raises it AND NEVER the edit is discarded before the dialog is answered

ALWAYS the zoom slider stands under the crop on both platforms, its thumb at the crop's zoom between the fill and 10×

WHEN move the zoom slider -> the picture zooms in place AND NEVER below the fill or past 10×

ALWAYS the post crop has one zoom ceiling under every shape, 10× the Tall frame's fill, so a shape switch never has to shrink a picture to meet a lower one

ALWAYS the stage stands as large as the column allows, its 390 × 488 and every frame inside it being the figures at a 390 column, and never taller than the window leaves once the header, the shape row, the zoom slider, the line, the strip, Next and their gaps have their place

ALWAYS a stage the window caps keeps its 390 : 488 and stands centred in the column, the frame and the picture scaling with it, and the blocks around it keep their sizes

ALWAYS the stage never stands under 240 high, and under that the page scrolls under the pinned Next

ALWAYS Next is pinned in the foot

WHEN press an arrow key GIVEN the crop has focus -> the picture moves 1 % that way AND NEVER past where its edge meets the crop's

WHEN press an arrow key with Shift held GIVEN the crop has focus -> the picture moves 10 % that way AND NEVER past where its edge meets the crop's

ALWAYS the line under the zoom slider reads One shape for the whole post.
