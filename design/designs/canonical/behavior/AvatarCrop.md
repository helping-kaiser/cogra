# AvatarCrop · `spec:design:behavior-avatar-crop`

ALWAYS the crop frames the profile's one picture in a circle at 1:1

ALWAYS the crop offers no shape chips

ALWAYS the circle stands still as the crop's frame, 342 × 342 at 24 below the top of the 390 × 390 stage, and the picture is what moves and zooms under it, on both platforms

ALWAYS the picture outside the circle stays in view under a 45 % black

ALWAYS Next is pinned in the foot

ALWAYS the stage stands as large as the column allows, its 390 × 390 and the circle inside it being the figures at a 390 column, and never taller than the window leaves once the header, the zoom slider, Next and their gaps have their place

ALWAYS a stage the window caps stays square and stands centred in the column, the circle and the picture scaling with it, and the blocks around it keep their sizes

ALWAYS the stage never stands under 240 high, and under that the page scrolls under the pinned Next

WHEN drag inside the crop -> the picture moves under the circle AND NEVER the circle moves

WHEN pinch inside the crop -> the picture zooms under the circle AND the zoom slider follows AND NEVER the circle changes size

WHEN press Next GIVEN the crop was opened from the avatar's change badge -> the picture's own seal opens

WHEN press Next GIVEN the crop was opened from Change picture on the profile edit -> the profile edit comes back holding the new picture AND NEVER the picture's own seal opens

WHEN press the header back arrow -> the screen that asked for the picture comes back AND the picture goes unused AND NEVER a pick stage opens

ALWAYS the header back arrow is named Back to the edit GIVEN the crop was entered from Change picture on the profile edit

ALWAYS the header back arrow is named Back to your profile GIVEN the crop was entered from the avatar's change badge

WHEN press the header X -> the flow is left AND nothing is signed

ALWAYS the zoom slider stands under the crop on both platforms, its thumb at the crop's zoom between the fill and 10×

WHEN move the zoom slider -> the picture zooms in place AND NEVER below the fill or past 10×

WHEN press an arrow key GIVEN the crop has focus -> the picture moves 1 % that way AND NEVER past where its edge meets the crop's

WHEN press an arrow key with Shift held GIVEN the crop has focus -> the picture moves 10 % that way AND NEVER past where its edge meets the crop's

WHEN a picked file is refused -> the crop opens with its circle empty AND the refusal's line stands under the circle in the error voice AND Next stays and dims AND NEVER the zoom slider stands AND NEVER a dialog or a snackbar carries the refusal

ALWAYS a refusal on the crop offers no Retry and no Remove it, the header back arrow its way out

WHEN a picture over 10 MiB is picked -> the crop's line reads That picture is too big — a picture can be up to 10 MB.

WHEN a moving GIF is picked -> the crop's line reads That GIF moves, and CoGra can't take a moving GIF here. A still one is fine.

WHEN a still GIF is picked -> it is converted on the device AND NEVER refused

WHEN a file nothing here reads as a picture is picked, a video included -> the crop's line reads That file isn't a picture CoGra can read.

WHEN press Next GIVEN the picked file was refused -> NEVER anything moves on

ALWAYS the refusal holds for both openers, the avatar's change badge and Change picture on the profile edit
