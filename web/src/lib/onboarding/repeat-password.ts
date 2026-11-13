// THE NEW PASSWORD, ASKED TWICE (round 38, jakob's J2; copy-voice *Field
// errors*): every form that sets a new password — Join, ResetNew,
// ChangePassword — draws `Repeat password` under the new one and refuses on
// the press when the two differ, under the repeat field. The line is a local
// one, so it re-checks as either field changes and goes once the two match;
// typing never raises it before the next press (Join.md, JoinErrors.md,
// ResetNew.md, ChangePassword.md).

/** The repeat field's line on a press that finds the two passwords apart. */
export const MISMATCH_LINE = "The two passwords don't match.";

/** The line a press says on the repeat field — null where the two match. */
export function mismatchOnPress(password: string, repeat: string): string | null {
  return password === repeat ? null : MISMATCH_LINE;
}

/**
 * The line after an edit to either field: a standing line goes once the two
 * passwords match and otherwise stands; no line ever appears by typing.
 */
export function mismatchAfterEdit(standing: string | null, password: string, repeat: string): string | null {
  return standing !== null && password === repeat ? null : standing;
}
