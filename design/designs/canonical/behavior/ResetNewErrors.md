# ResetNewErrors · `spec:design:behavior-reset-new-errors`

ALWAYS the board is one reachable moment, not a composite: the form after a press of Set the new password whose New password and Repeat password differ

WHEN press Set the new password GIVEN Repeat password differs from New password -> reset.confirm.support reads The two passwords don't match. AND the field takes the error state AND NEVER the password changes

ALWAYS the fields keep what was typed through the refusal, and New password keeps its own hint, At least 12 characters.

WHEN typing in New password or Repeat password GIVEN reset.confirm.support reads The two passwords don't match. -> the line re-checks as the text changes AND it goes once the two passwords match

ALWAYS Set the new password stands live, the retry

ALWAYS the screen carries no header and no back arrow, as ResetNew
