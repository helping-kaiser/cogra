# DiscardConfirm · `spec:design:behavior-discard-confirm`

WHEN the reader leaves the reply composer by its X or its back arrow GIVEN something is written -> the dialog Discard this reply? opens over the composer with Nothing is kept.

WHEN the reader leaves the reply composer by its X or its back arrow GIVEN nothing is written -> the composer leaves at once AND NEVER the dialog opens

ALWAYS Keep writing is the filled answer and Discard the quiet one

WHEN tap Keep writing -> the dialog closes onto the composer as it was

WHEN tap Discard -> the reply is discarded AND the thread returns AND NEVER a draft is kept
