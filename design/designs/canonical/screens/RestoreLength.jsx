/* Restore · the code is the wrong length — the one shape problem a reader
   can act on (the key-loss round; auth.md, "Blob format": only a wrong
   length is reported as a shape problem). The field holds what was typed,
   because the line answers it: 21 characters once the fold has taken the
   dashes out, five short of the 26 a code always has. Checked on the
   press, like every field line but the recovery gate's, and once marked
   re-checked as the reader types, the line going at 26 (jakob 2026-10-05). */
export const PROPS = { wording: { editor: "enum", options: ["browser", "app"], default: "browser" } };
export const VALS = `restoreBody: this.props.wording === "app" ? "Enter your recovery code to bring your signing key into this app." : "Enter your recovery code to bring your signing key onto this browser."`;

export function Screen() {
  return <RestoreBody value="7Q3ZD-XK9P2-M4TVE-0RH8N-1" error="A recovery code is 26 characters." />;
}
