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

   THE PROOF STEP IS THE PLATFORM'S (jakob 2026-09-09, item 20's ruling on the
   replace divergence): replacing the code destroys the old backup and reveals
   a new secret, so the device confirms who is holding it first. Android has a
   biometric or screen-lock gate and uses it; a browser has none, so it asks
   for the current code. The board draws the browser's, the way every platform
   line on these boards is drawn browser-first — the flow is one flow and the
   proof is each platform's own.

   THE CONSEQUENCE IS SAID BEFORE THE ACT, not in the snackbar after it: a new
   code replaces the old one and recovery always uses the newest. */
export function Screen() {
  return (
    <>
      <PageHeader title="Recovery code" backHref="/settings" backLabel="Back to settings" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 32px" }}>
        <Card>
          <FactRow label="Last created" value="12 August" last />
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-body-medium)",
              lineHeight: "var(--text-body-medium--line-height)",
              letterSpacing: "var(--text-body-medium--letter-spacing)",
              color: "var(--text-secondary)",
            }}
          >
            A new code re-encrypts your key and replaces the old backup — recovery always uses the
            newest one.
          </p>
          <TextField id="settings-rekey-code" label="Current recovery code" mono value="" />
          <Button size="sm" selfStart>
            Create a new recovery code
          </Button>
        </Card>
        <QuietNote>
          The new code is shown once and never stored. Have somewhere to write it down before you
          go on.
        </QuietNote>
      </div>
    </>
  );
}
