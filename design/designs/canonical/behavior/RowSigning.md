# RowSigning · `spec:design:behavior-row-signing`

WHEN a press-and-hold on a stance face reaches 500ms -> the modest positive +0.10 / +0.10 is signed without the pad AND the anchor refuses a second hold until the signing answers AND NEVER the face moves before the signature is taken

WHEN the hold's signing has not answered 200ms after the hold -> the line under the face reads Signing… in the pending marker's quiet register AND NEVER a spinner appears

WHEN the hold's signing answers within 200ms of the hold -> NEVER the line Signing… appears

WHEN the hold's signing is taken -> the face moves to the new opinion AND the line under it goes AND the snackbar confirms the signature

WHEN the hold's signing does not go through -> the face stays where it was AND the line under it reads That didn't sign. in the failure voice followed by Retry AND NEVER the snackbar carries the failure

ALWAYS the row line stands under the face, in the slot the pending marker uses, on one line

ALWAYS the failure line is announced as an alert

WHEN tap Retry on the row line GIVEN the hold did not sign -> the same hold is signed again AND the line under the face reads Signing… once 200ms pass without an answer

WHEN a read-side comfort on the target does not go through -> the comfort reverts AND the line under the face reads That didn't go through. in the failure voice followed by Retry AND the face never moves AND NEVER the snackbar carries the failure

WHEN tap Retry on the row line GIVEN a comfort did not go through -> the comfort is asked again AND NEVER anything is signed

ALWAYS save, unsave, hide, undo and unhide answer at the tap and revert on failure, and every signed act waits for its signature
