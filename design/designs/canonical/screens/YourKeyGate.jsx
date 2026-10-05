/* YOUR KEY, BEHIND ITS GATE — the browser's proof before the export (the
   key-loss round; auth.md, "Revealing or replacing key material"). Once a
   backup exists the browser wipes the raw seed and keeps only a key it cannot
   read out, so the export has to open the backup to show anything — and the
   current recovery code is what opens it.

   IT STANDS IN `SettingsBackup`'S COLUMN, and for `SettingsBackup`'s reason:
   the same secret asked for in the same words, a heading, one line saying
   why, the field, the commitment. Its heading is the row's and the export's
   own, `Your key`, because this is the export's first step rather than a
   screen of its own.

   THE OTHER PLATFORMS' GATES ARE NOT BOARDS. Android's proof is the phone's
   own unlock — a system prompt, cancelled by staying on the settings page,
   and warned about first on a phone with no screen lock (`NoScreenLock`). A
   browser that still keeps the seed (no backup yet) asks nothing, because a
   prompt there would prove nothing. A refused code wears `RestoreError`'s
   line in place; offline is `NetworkError`'s. */
export function Screen() {
  return (
    <>
      <PageHeader title="Your key" backHref="/settings" backLabel="Back to settings" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          On this browser your key is sealed inside its backup. Enter your recovery code to open it and see the key.
        </p>

        <div style={{ marginTop: 32 }}>
          <TextField
            id="your-key-gate-code"
            label="Current recovery code"
            mono
            enterKeyHint="go"
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX"
            value=""
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <WaitingCommit id="your-key-gate" label="Show my key" reason="Waiting for your recovery code" />
        </div>
      </div>
    </>
  );
}
