/* THE SETTINGS BACKUP — replacing your recovery code, on a screen of its own
   (readme §13, the settings round; backlog item 41.1, ruled by jakob
   2026-09-09). Reached from the settings page's Recovery code row.

   IT HAS ITS OWN SCREEN BECAUSE THE STAKES ARE THE CEREMONY'S. Both apps show
   the new code inside a card on the settings page, where the ceremony's trap —
   back swallowed until the code is typed back — cannot be drawn without
   stranding the reader in settings. Split in two, both halves are drawable:
   this screen states the consequence and takes the proof, and the drawn
   `RecoveryCode` board is what "Create a new recovery code" leads to, trap and
   all. Nothing is lost by leaving THIS screen, so it keeps its back arrow.

   IT IS `Restore`'S SHAPE, and that is the point rather than a convenience:
   the two screens ask for the same secret in the same words for opposite
   reasons — one to bring a key back, one to re-wrap it — so a reader who has
   met the first should recognise the second on sight. Heading, one line of
   consequence, the field, the commitment, and the thing to know last.

   THE PROOF STEP IS THE PLATFORM'S (jakob 2026-09-09, item 20's ruling on the
   replace divergence): replacing the code destroys the old backup and reveals
   a new secret, so the device confirms who is holding it first. Android has a
   biometric or screen-lock gate and uses it; a browser has none, so it asks
   for the current code. The board draws the browser's, the way every platform
   line on these boards is drawn browser-first — one flow, each platform's own
   proof. ON ANDROID this is the same screen without the field or the lost-code
   line: the commitment raises the phone's own unlock, a cancelled prompt leaves
   the screen as it was, and a phone with no screen lock is warned first
   (`NoScreenLock`, drawn over that layout).

   THE CONSEQUENCE IS SAID BEFORE THE ACT, never only in the snackbar after
   it — and the consequence is that nothing is lost by walking away (the
   key-loss round): the new backup uploads only once the new code is typed back
   on the code screen, so the old code keeps working until then, and an
   abandoned code screen leaves the old backup exactly as it was.

   A BROWSER THAT LOST ITS CODE IS TOLD WHERE TO GO (the key-loss round). The
   browser's key is sealed behind the backup it would replace, so without the
   current code it cannot re-key (web.md) — and a reader retrying the field
   forever is the dead end the quiet line under it closes. The wrong code is
   `SettingsBackupError`; offline is `NetworkError`'s. */
export function Screen() {
  return <SettingsBackupBody />;
}
