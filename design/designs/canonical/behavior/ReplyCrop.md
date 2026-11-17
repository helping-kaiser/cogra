# ReplyCrop · `spec:design:behavior-reply-crop`

ALWAYS every picture a reply or a comment edit takes passes this crop after the platform's picker and before it joins the composer's tray, on both platforms

ALWAYS the crop's frame is the comment's square and never another shape, the frame standing 342 × 342 at 73 below the top of the 390 × 488 stage, between the 24 gutters, the cover crop's square

ALWAYS the crop offers no shape chips and no line under the zoom slider

ALWAYS the crop's frame stands still at the square, and the picture is what moves and zooms under it, on both platforms

ALWAYS the picture outside the frame stays in view under a 45 % black

ALWAYS the strip of the picked pictures stands under the zoom slider GIVEN more than one picture was picked, the framed picture outlined and the rest at 65 %

ALWAYS no strip stands GIVEN one picture was picked

WHEN drag inside the crop viewport -> the picture moves under the frame AND NEVER the frame moves AND NEVER an edge of the picture comes inside the frame

WHEN pinch inside the crop viewport -> the picture zooms under the frame AND the zoom slider follows AND NEVER the frame changes size

WHEN tap a picture in the strip -> that picture takes the crop viewport for its own framing AND every other picture keeps the framing it was given

WHEN press Next GIVEN the crop was entered from the reply composer -> the composer comes back with the pictures in its tray as their squares AND the pictures' cropped exports start uploading AND NEVER an uncropped picture leaves the device

WHEN press Next GIVEN the crop was entered from a comment edit -> the edit comes back with the pictures on its pictures row as their squares AND the pictures' cropped exports start uploading AND NEVER an uncropped picture leaves the device

ALWAYS a crop opened by adding pictures to a tray that already holds some takes the new pictures only, and the pictures already in the tray keep the framing they were given

WHEN press the header back arrow -> the composer or the edit that opened the crop comes back as it was AND the picked pictures go unused AND NEVER a pick stage opens

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
