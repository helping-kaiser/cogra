/* No screen lock — Android's warning in front of revealing or replacing key
   material (the key-loss round; auth.md, "Revealing or replacing key
   material"). The proof on Android is the phone's own unlock, and a phone with
   neither a biometric nor a screen lock has none to give: it is warned and
   may go on, because locking the holder out of their own key is the worse
   failure.

   ONE DIALOG, THREE DOORS. It stands in front of every act that gate guards —
   `Create a new recovery code`, `Make a recovery code`, and the `Your key`
   row — and is drawn once, over `SettingsBackup` in Android's layout (no
   field: the unlock is the proof there).

   A THINK-TWICE DIALOG, BY THE RULE (readme §11, Dialogs): going on shows a
   secret with nothing between it and whoever holds the phone, which cannot be
   taken back. The SAFE answer is filled and keeps the right-hand slot; the
   scrim and the system's Back take it too. */
export function Screen() {
  return (
    <>
      <SettingsBackupBody app />
      <DialogSurface ariaLabel="This phone has no screen lock">
        <h2
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          This phone has no screen lock
        </h2>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          Anyone who picks it up could see your key or replace your recovery code. You can go on, or set a screen lock
          first.
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 24 }}>
          <Button variant="text" size="sm">
            Go on anyway
          </Button>
          <Button size="sm">Cancel</Button>
        </div>
      </DialogSurface>
    </>
  );
}
