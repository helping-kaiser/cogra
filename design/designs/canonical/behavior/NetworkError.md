# NetworkError · `spec:design:behavior-network-error`

ALWAYS a refused or failed act's words follow the answer and its shape follows the host

ALWAYS no answer at all reads That didn't send. Try again., an answered refusal reads That didn't go through. Try again., and a signed act answered on a target's row reads That didn't sign.

ALWAYS a refusal the signer on the device makes itself, with no server answer at all, reads as an answered refusal, That didn't go through. Try again.

WHEN the signing gets no answer at all -> the line That didn't send. Try again. takes the commit's place AND an outlined Retry stands under it AND Back stands under Retry

ALWAYS the fault line is in the failure voice, the error colour, and announced as an alert

ALWAYS every row of the acts card and every fact row reads back exactly what the author was about to sign GIVEN the fault stands

ALWAYS the fault is added at the foot and never replaces the seal with an error screen

ALWAYS nothing the author chose is lost GIVEN the fault stands

WHEN the server answers INTERNAL or FORBIDDEN -> the line That didn't go through. Try again. takes the commit's place AND an outlined Retry stands under it AND NEVER the line says the server can't be reached

WHEN the server answers SIGNATURE_INVALID -> the line That didn't go through. Try again. takes the commit's place AND an outlined Retry stands under it

WHEN the server answers BAD_INPUT naming no field -> the line That didn't go through. Try again. takes the commit's place AND an outlined Retry stands under it

WHEN the server answers EMAIL_NOT_VERIFIED -> the line Verify your email first — the link is in your inbox. takes the commit's place AND an outlined Retry stands under it

WHEN the server answers UNAUTHENTICATED or REFRESH_TOKEN_INVALID mid-session -> the sign-in screen opens with You've been signed out. under its heading AND the draft and any kept picks stay on this device

WHEN press Retry -> the same signing is asked again AND past 200ms the commit's slot reads the original commit's in-flight label AND Back reads Close again

ALWAYS Retry is the only re-send: the seal never asks again by itself, and the design sets no timeout of its own

WHEN press Retry GIVEN the signing goes through this time -> the post's own detail view opens wearing Still settling

WHEN press Retry GIVEN still no answer reaches the seal -> the fault stays in place

WHEN press Retry GIVEN the write rule refuses -> the notice You can't sign right now takes the commit's place AND nothing is staged or spent AND the draft is kept

WHEN press Retry GIVEN a cited post never landed -> that citation's row reads This post didn't land, so it can't be cited. followed by Remove it

WHEN press Retry GIVEN any other staged act is refused -> the notice This shouldn't have happened takes the commit's place with Try again, Report a problem and Discard the post

WHEN press Back -> the details stage comes back, one stage behind

WHEN an edit's signing fails while the edit stands open -> the line in its answer's words takes Sign the edit's place AND an outlined Retry stands under it AND the acts count stays above the line AND NEVER a Back stands under Retry, the header's arrow and X being the edit's way back

WHEN a pad's Set gets no answer -> the pad stays open at the pick AND the line That didn't send. Try again. stands above the commit row AND an outlined Retry takes Set's slot

WHEN a pad's Set is answered with a refusal -> the pad stays open at the pick AND the line That didn't go through. Try again. stands above the commit row AND an outlined Retry takes Set's slot

WHEN a dialog's or a small sheet's commitment gets no answer -> it stays up with its pair AND the line That didn't send. Try again. stands in it AND the commitment reads Retry

WHEN a dialog's or a small sheet's commitment is answered with a refusal -> it stays up with its pair AND the line That didn't go through. Try again. stands in it AND the commitment reads Retry

WHEN an act on a card is answered with a refusal -> the line That didn't go through. stands last on the card with Retry at its end AND the card stays

WHEN a form's submit gets no answer -> every field keeps what was typed AND the fault line stands on the form

WHEN a press-and-hold gets no answer -> the face stays where it was AND the target's row reads That didn't sign. followed by Retry

ALWAYS a failure is never carried on the snackbar
