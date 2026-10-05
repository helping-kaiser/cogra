# SealSigning · `spec:design:behavior-seal-signing`

ALWAYS a seal's commit names what it signs and is the one committing action on the seal

WHEN the commit is pressed -> the commit refuses a second press until the signing answers AND NEVER the commit dims AND NEVER a spinner appears

WHEN the signing answers within 200ms of the press -> NEVER the commit's label swaps AND NEVER anything on the seal shows a wait

WHEN the signing has not answered 200ms after the press -> the commit reads its verb's present participle in its own place, the rest of its label kept and … closing it AND NEVER a spinner appears

ALWAYS Sign and publish reads Signing and publishing… GIVEN the post's seal has signed for more than 200ms without an answer

WHEN the signing has not answered 200ms after the press -> the header back arrow, Back and the header X refuse a press AND NEVER they dim AND NEVER their face changes

ALWAYS the fact rows stay readable GIVEN the commit reads its in-flight label

WHEN the signing has not answered 200ms after the press -> every fact row's Change, Adjust and Mark refuse a press AND NEVER they dim

WHEN press Android's system Back GIVEN the commit reads its in-flight label -> NEVER the seal is left AND NEVER the signing is abandoned

ALWAYS the header's ? stays live and opens the signing text GIVEN the commit reads its in-flight label

WHEN press the browser's back on the web GIVEN the commit reads its in-flight label -> the browser's own history decides AND NEVER the seal intercepts it

ALWAYS the design sets no timeout of its own: the seal waits on the signing's own answer, the slow line standing past 5s for as long as it takes

ALWAYS a seal never sends a signing again by itself: Retry is the only re-send

WHEN press Retry -> the same signing is asked again AND past 200ms the commit's slot reads the original commit's in-flight label, Signing and publishing… on the post's seal AND the header back arrow, Back and the header X refuse a press again AND NEVER the slot reads a Retry of its own in flight

WHEN the reader goes a stage back and returns, or changes a fact, GIVEN a refusal reading stood on the seal -> the seal shows its plain commit AND NEVER the refusal reading stands again before the next press

WHEN the commit is pressed again GIVEN a refusal reading stood and the reader went a stage back or changed a fact -> the signing answers anew

ALWAYS the acts card reads back exactly what it read before the press GIVEN the commit reads its in-flight label

WHEN the signing has not answered 5s after the press -> the subline under the acts card's total reads Still signing — the network is slow right now. AND the commit keeps its in-flight label AND NEVER a progress indicator appears

ALWAYS the 200ms and the 5s marks count from the press of the commit

ALWAYS nothing on a signing seal feigns progress: no bar, no percentage, no named steps

ALWAYS the commit stays enabled GIVEN the seal's uploads are still running

WHEN the commit is pressed GIVEN the seal's uploads are still running -> the press is held AND NEVER anything is signed before the last upload lands AND NEVER the commit dims

WHEN the last upload lands GIVEN the press is held -> signing proceeds AND NEVER a second press is asked

WHEN an upload fails GIVEN the press is held -> the held press drops AND the commit reads its resting label again AND the header back arrow, Back and the header X answer again AND NEVER anything is signed

ALWAYS the commit is disabled only while a failed upload stands, and the gate line above it says why

WHEN the signing is taken GIVEN the seal is the post's -> the post's own detail view opens wearing Still settling AND the snackbar reads Signed — it's in the thread now, still settling.

WHEN the signing does not go through GIVEN no answer reached the seal -> the fault line and Retry take the commit's place AND everything above the foot stays as it was

WHEN the signing is refused for one staged citation GIVEN the cited post never landed -> that citation's row says so with Remove it AND the commit stays AND NEVER Retry appears

WHEN the signing is refused for one staged act GIVEN the act's target landed -> the notice This shouldn't have happened takes the commit's place AND NEVER a row is marked

WHEN the write rule refuses the signing -> the notice You can't sign right now takes the commit's place AND nothing is staged or spent AND NEVER Retry appears

WHEN the app opens again GIVEN it was closed while a signing was in flight -> the signing's outcome shows as the ordinary settled or failure notice

ALWAYS the acts on a seal land together or none of them lands
