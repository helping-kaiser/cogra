# ChangePasswordErrors · `spec:design:behavior-change-password-errors`

ALWAYS the board is one reachable moment, not a composite: the form after a press of Change password whose New password and Repeat password differ

WHEN press Change password GIVEN Repeat password differs from New password -> changePassword.confirm.support reads The two passwords don't match. AND the Repeat password field takes M3's error state, its outline and its label in the error colour AND NEVER the password changes

ALWAYS a local refusal stops the press before the server is asked, so That password isn't right. and the breach line never stand with The two passwords don't match.

ALWAYS the fields keep what was typed through the refusal, and New password keeps its own hint, At least 12 characters.

WHEN typing in New password or Repeat password GIVEN changePassword.confirm.support reads The two passwords don't match. -> the line re-checks as the reader types and goes once the two passwords match

ALWAYS Change password stands live, the retry

WHEN press the header back arrow -> settings returns AND NEVER the password changes
