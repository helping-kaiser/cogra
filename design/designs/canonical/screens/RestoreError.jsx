/* Restore · the code doesn't check out — the input-error round (readme
   §13, entry): the recovery-code field wears M3's error state, wording
   the server's rejection of a code that doesn't resolve. */
export const PROPS = { wording: { editor: "enum", options: ["browser", "app"], default: "browser" } };
export const VALS = `restoreBody: this.props.wording === "app" ? "Enter your recovery code to bring your signing key into this app." : "Enter your recovery code to bring your signing key onto this browser."`;

export function Screen() {
  return <RestoreBody error="That code doesn't check out." />;
}
