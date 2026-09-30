/* Restore — brings a signing key onto a device that doesn't have it
   (readme §13, entry): reached from KeyElsewhere and every key-absent state
   that offers the restore — the composer's seal, the pad, the backup settings
   and Your key. The wording chip flips the body
   copy between the browser and the installed app, same as KeyElsewhere.

   THE CODE IS READ THE WAY EVERY CODE INPUT READS IT (auth.md, "Blob
   format"; `readRecoveryCode`, the `RecoveryCode` master's fold): case,
   dashes and spaces never matter, and `I`, `L`, `O` are read as `1`, `1`,
   `0`. What survives the fold is checked on the press.

   TWO REFUSALS, BECAUSE A READER CAN ACT ON ONE (the key-loss round). A code
   of the wrong length after the fold is a shape the reader can fix, so it is
   named — `RestoreLength`, `A recovery code is 26 characters.` Every other
   failure is one line, `RestoreError`'s, since telling a wrong character from
   a wrong backup would help nobody but a guesser. Offline is `NetworkError`'s:
   the restore fetches the backup before it can open it.

   SUCCESS SAYS SO, AND WHAT OPENED IT CHANGES WITH IT. The reader returns
   where restore began, with the snackbar `Your key is on this browser now.`
   (`…in this app now.` in the app) — and the key-absent state that sent them
   is gone: the settings row that opened restore re-renders as its key-present
   board (`SettingsBackup`, `YourKey`), the feed's task card leaves, and a
   draft or a pick that waited on the key goes on to be signed. */
export const PROPS = { wording: { editor: "enum", options: ["browser", "app"], default: "browser" } };
export const VALS = `restoreBody: this.props.wording === "app" ? "Enter your recovery code to bring your signing key into this app." : "Enter your recovery code to bring your signing key onto this browser."`;

export function Screen() {
  return <RestoreBody />;
}
