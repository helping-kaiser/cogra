# ReplyCrop · `spec:design:behavior-reply-crop`

ALWAYS every picture a reply or a comment edit takes passes this crop after the platform's picker and before it joins the composer's tray, on both platforms

ALWAYS the crop's frame is the comment's square and never another shape, the frame standing 342 × 342 at 73 below the top of the 390 × 488 stage, between the 24 gutters, the cover crop's square

ALWAYS the crop offers no shape chips and no line under the zoom slider

ALWAYS the crop's frame stands still at the square, and the picture is what moves and zooms under it, on both platforms

ALWAYS the picture outside the frame stays in view under a 45 % black

ALWAYS the stage stands as large as the column allows, its 390 × 488 and the frame inside it being the figures at a 390 column, and never taller than the window leaves once the header, the zoom slider, the strip, Next and their gaps have their place

ALWAYS a stage the window caps keeps its 390 : 488 and stands centred in the column, the frame and the picture scaling with it, and the blocks around it keep their sizes

ALWAYS the stage never stands under 240 high, and under that the page scrolls under the pinned Next

ALWAYS Next is pinned in the foot

ALWAYS the strip of the picked pictures stands under the zoom slider GIVEN more than one picture was picked, the framed picture outlined and the rest at 65 %

ALWAYS no strip stands GIVEN one picture was picked

WHEN drag inside the crop viewport -> the picture moves under the frame AND NEVER the frame moves AND NEVER an edge of the picture comes inside the frame

WHEN pinch inside the crop viewport -> the picture zooms under the frame AND the zoom slider follows AND NEVER the frame changes size

WHEN tap a picture in the strip -> that picture takes the crop viewport for its own framing AND every other picture keeps the framing it was given

WHEN press Next GIVEN the crop was entered from the reply composer -> the composer comes back with the pictures in its tray as their squares AND the pictures' cropped exports start uploading AND NEVER an uncropped picture leaves the device

WHEN press Next GIVEN the crop was entered from a comment edit -> the edit comes back with the pictures on its pictures row as their squares AND the cropped exports of the pictures added or re-framed in this visit start uploading AND NEVER an uncropped picture leaves the device

ALWAYS a crop opened by adding pictures to the reply composer's tray that already holds some takes the new pictures only, and the pictures already in the tray keep the framing they were given

ALWAYS the strip holds every picture of the comment in the edit's order, the pictures the comment already holds and the ones just added, GIVEN the crop was entered from a comment edit

WHEN the crop is reached by adding pictures to a comment's edit -> the strip holds the comment's pictures and the new ones AND the first new picture takes the crop viewport

WHEN the crop is opened from a picture's own crop door on a comment's edit -> that picture takes the crop viewport AND the strip holds every picture of the comment

ALWAYS a picture the comment already holds is framed within its published square, the only part of it that ever left the device, so it can be framed tighter and never wider

ALWAYS the zoom slider's floor is the published square's fill and its ceiling 10× GIVEN the picture in the crop viewport is one the comment already holds

ALWAYS a picture the comment already holds whose framing stands as published is not replaced, and one whose framing changed is a replacement of that picture in the signed edit

ALWAYS a replaced picture rides the comment edit's own record, the comment's new content state, as an added or a removed picture does, staging that record when nothing else has and adding no row and nothing to the count when it is already staged

WHEN press the header back arrow GIVEN the crop was entered from the reply composer -> the composer comes back as it was AND the picked pictures go unused AND NEVER a pick stage opens

WHEN press the header back arrow GIVEN the crop was entered from a comment edit -> the edit comes back as it was before the crop opened AND every picture added and every framing changed in this visit goes unused AND NEVER a pick stage opens

ALWAYS the header back arrow is named Back a step GIVEN the crop was entered from the reply composer

ALWAYS the header back arrow is named Back to the edit GIVEN the crop was entered from a comment edit

WHEN press the header X GIVEN the crop was entered from a reply composer that holds words or pictures -> DiscardConfirm opens, as the reply's own X raises it AND NEVER the reply is discarded before the dialog is answered

WHEN press the header X GIVEN the crop was entered from an empty reply composer -> the reply is left at once for where it was opened from, as the reply's own X leaves it

WHEN press the header X GIVEN the crop was entered from a comment edit changed since it opened -> DiscardConfirm opens, as the edit's own X raises it AND NEVER the edit is discarded before the dialog is answered

WHEN press the header X GIVEN the crop was entered from a comment edit unchanged since it opened -> the edit is left at once, as the edit's own X leaves it

ALWAYS the header X is named Leave — the reply is discarded GIVEN the crop was entered from the reply composer

ALWAYS the header X is named Leave — the edit is discarded GIVEN the crop was entered from a comment edit

ALWAYS a file over its cap or in a format nothing here reads is refused on the composer's media row before the crop, and never reaches the crop

ALWAYS the zoom slider stands under the crop on both platforms, its thumb at the crop's zoom between the fill and 10×

WHEN move the zoom slider -> the picture zooms in place AND NEVER below the fill or past 10×

WHEN press an arrow key GIVEN the crop has focus -> the picture moves 1 % that way AND NEVER past where its edge meets the crop's

WHEN press an arrow key with Shift held GIVEN the crop has focus -> the picture moves 10 % that way AND NEVER past where its edge meets the crop's
