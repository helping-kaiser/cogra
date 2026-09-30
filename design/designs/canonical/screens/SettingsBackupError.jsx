/* A new recovery code · the current one doesn't check out (the key-loss
   round). `SettingsBackup`'s field wearing M3's error state, in `RestoreError`'s
   words: the two screens ask for the same secret, and a refused code is said
   the same way on both. The lost-code line stays beneath it — this is the
   state a reader who lost the code actually reaches, so it is where the way
   on matters most. */
export function Screen() {
  return <SettingsBackupBody error="That code doesn't check out." />;
}
