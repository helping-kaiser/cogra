# SigningAfterClose · `spec:design:behavior-signing-after-close`

ALWAYS a signed act whose surface was closed while it signed shows its wait and its failure where it lands AND never on the snackbar

WHEN a seal, the reply's seal or an edit is closed GIVEN its commit was pressed -> the surface leaves AND the act goes on AND NEVER the act is cancelled

WHEN the post's signing has not answered GIVEN its seal was closed -> the feed's head reads Signing and publishing… above the first card in the pending marker's quiet register AND NEVER a card stands for the post before its signature is taken

WHEN the post's signing is taken GIVEN its seal was closed -> the line goes AND the post's card stands at the feed's head wearing Still settling AND the snackbar reads Signed — it's in the thread now, still settling.

WHEN the post's signing does not go through GIVEN its seal was closed -> the feed's head reads Your post didn't sign. in the failure voice followed by Retry AND the draft stays on this device AND NEVER the snackbar carries the failure

WHEN press New post GIVEN the post's line reads Your post didn't sign. -> the draft card leads the screen AND Continue resumes the draft at its seal

WHEN the reply's signing has not answered GIVEN its seal was closed -> the branch it answers opens AND at the branch's end the line Signing comment… stands in the pending marker's quiet register AND NEVER a card stands for the reply before its signature is taken

WHEN the reply's signing is taken GIVEN its seal was closed -> the line goes AND the reply settles at the branch's end wearing Still settling

WHEN the reply's signing does not go through GIVEN its seal was closed -> at the branch's end the line reads Your comment didn't sign. in the failure voice followed by Retry AND NEVER the snackbar carries the failure

WHEN the edit's signing has not answered GIVEN the edit was closed -> the edited card stands as it was AND the line under it reads Signing… in the pending marker's quiet register

WHEN the edit's signing is taken GIVEN the edit was closed -> the card shows the edit AND the line goes AND the card wears Still settling

WHEN the edit's signing does not go through GIVEN the edit was closed -> the card stands as it was AND the line under it reads That didn't sign. in the failure voice followed by Retry AND NEVER the snackbar carries the failure

WHEN tap Retry on a line of this pattern -> the same signing is asked again AND the line reads its wait again once 200ms pass without an answer AND NEVER anything else is signed

ALWAYS the failure line is announced as an alert, and the wait line as a status

ALWAYS a line of this pattern stands until its act answers or Retry is pressed, and never fades on a timer

WHEN the signing is refused for a staged citation or tag GIVEN the surface was closed -> the line reads the failure as any failure reads AND the post's draft carries the refusal to its seal at the next press

WHEN the app opens again GIVEN it was closed while a signing was in flight -> the signing's outcome shows where it lands, as this pattern draws it
