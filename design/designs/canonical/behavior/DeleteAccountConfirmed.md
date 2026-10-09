# DeleteAccountConfirmed · `spec:design:behavior-delete-account-confirmed`

WHEN the deletion mail's link is opened -> the deletion is confirmed AND the seven-day grace starts AND the landing opens AND NEVER the confirmation waits on a sign-in

WHEN the deletion mail's link is opened again GIVEN the deletion is in its grace -> the same landing opens AND its heading counts the days left AND NEVER the grace restarts

ALWAYS the heading's days left round to the nearest whole day while 24 hours or more remain, then it counts the hours left, rounded up

WHEN the deletion mail's link is opened GIVEN the deletion was canceled -> the spent link's landing opens, This link doesn't work anymore AND NEVER the deletion is confirmed again

ALWAYS the landing carries no back arrow

ALWAYS the landing's heading is the band's sentence on its first day, with the deadline's date spelled out under it, and says nothing changes until then and any device can cancel

ALWAYS the heading reads Your account is deleted in 7 days GIVEN the content sweep is not in the deletion

ALWAYS the heading reads Your account and everything you posted are deleted in 7 days GIVEN the content sweep is in the deletion

ALWAYS the landing offers Also remove what I posted, unticked, with Add it to the deletion GIVEN the request left the content sweep off

ALWAYS the landing offers no content sweep GIVEN the sweep was chosen at the request

ALWAYS the landing never offers to take the content sweep back out

WHEN tap Also remove what I posted -> the box ticks or unticks AND NEVER anything changes until Add it to the deletion is pressed

WHEN press Add it to the deletion GIVEN the box is ticked -> the content sweep joins the deletion AND the heading reads the longer sentence AND the sweep's block goes AND the snackbar reads Added — what you posted goes too.

WHEN press Add it to the deletion GIVEN the box is unticked -> the deletion stands confirmed account-only, exactly as the link left it AND NEVER the sweep joins

WHEN the add has not answered 200ms after the press -> Add it to the deletion reads Adding it to the deletion… in its own place AND NEVER a spinner appears

WHEN press Add it to the deletion GIVEN no answer reaches the device -> the box keeps its tick AND the line That didn't send. Try again. stands above Add it to the deletion AND Add it to the deletion stays, the retry AND NEVER the sweep joins the deletion

ALWAYS the way on reads Go to the feed GIVEN a session is on this device

ALWAYS one quiet line above the way on reads You're not signed in here, and you don't need to be — the link was the proof. and the way on reads Sign in GIVEN no session is on this device

WHEN tap Go to the feed -> the feed opens under the deletion band

WHEN tap Sign in GIVEN no session is on this device -> the sign-in screen opens AND the deletion stays confirmed
