# SealFaultRow · `spec:design:behavior-seal-fault-row`

WHEN the signing is refused for one staged citation GIVEN the cited post never landed -> the References row reads back exactly as before AND under its value the line This post didn't land, so it can't be cited. stands in the failure voice followed by Remove it AND Sign and publish stays

WHEN the signing is refused for one staged citation GIVEN the cited comment never landed -> under the citation's value the line This comment didn't land, so it can't be cited. stands in the failure voice followed by Remove it AND the commit stays

WHEN the signing is refused for one staged citation GIVEN the References row reads a count of citations and the cited post never landed -> the line This post didn't land, so it can't be cited. stands under the References row followed by Remove it AND the refused citation is named only in Remove it's accessible name

ALWAYS the refused citation's line stands under the citation's own value, one reading, GIVEN the References row reads the one citation by name

ALWAYS nothing is staged, signed or spent GIVEN the refused citation's line stands

WHEN the reader goes a stage back and returns, or changes a fact, GIVEN the refused citation's line stood -> the seal shows its plain commit AND NEVER the line stands again before the next press

ALWAYS no fault stands at the foot and no Retry appears anywhere GIVEN the refused citation's line stands

ALWAYS every other row of the acts card and every fact row reads back exactly as before GIVEN the refused citation's line stands

ALWAYS a cited post that is still settling, the reader's own or anyone else's, is the one picked target that can stop answering

WHEN press Remove it -> the citation leaves the staged set AND its row goes AND the count and the total fall by one AND the seal is ready to sign again AND NEVER anything is signed

WHEN press Sign and publish GIVEN the refused citation is still staged -> the same row line comes back AND NEVER anything is signed

WHEN press Sign and publish GIVEN the refused citation was removed and the signing is taken -> the post's own detail view opens wearing Still settling

WHEN press Sign and publish GIVEN the refused citation was removed and the signing key is not on this device -> the key notice takes the commit's place AND nothing is staged or signed

WHEN press Sign and publish GIVEN the refused citation was removed and no answer reaches the seal -> the fault line and Retry take the commit's place

WHEN press Sign and publish GIVEN the refused citation was removed and the write rule refuses -> the notice You can't sign right now takes the commit's place AND the draft is kept

WHEN press Sign and publish GIVEN any other staged act is refused -> the notice This shouldn't have happened takes the commit's place with Try again, Report a problem and Discard the post

WHEN tap a fact row's Change, Adjust or Mark GIVEN the refused citation's line stands -> that fact's sheet or pad opens as it does on the seal

WHEN tap the header's ? -> the signing text opens

WHEN press the header back arrow -> the details stage comes back, one stage behind

WHEN press Back -> the details stage comes back, one stage behind

WHEN press the header X -> the whole flow is left AND the draft is kept AND NEVER a dialog asks
