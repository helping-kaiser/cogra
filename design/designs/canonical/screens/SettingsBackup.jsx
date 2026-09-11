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
   proof.

   THE CONSEQUENCE IS SAID BEFORE THE ACT, never only in the snackbar after
   it: the old backup stops working the moment the new code exists. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="/settings" backLabel="Back to settings" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          A new recovery code
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          A new code re-encrypts your key and replaces the old backup — recovery always uses the
          newest one. Your current code was made on 12.08.2026.
        </p>

        <div style={{ marginTop: 32 }}>
          <TextField
            id="settings-rekey-code"
            label="Current recovery code"
            mono
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX"
            value=""
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <Button style={{ width: "100%" }}>Create a new recovery code</Button>
        </div>

        <p
          style={{
            margin: "24px 0 0",
            fontSize: "var(--text-body-small)",
            lineHeight: "var(--text-body-small--line-height)",
            letterSpacing: "var(--text-body-small--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          The new code is shown once and never stored. Have somewhere to write it down before you go
          on — the old code stops working as soon as the new one exists.
        </p>
      </div>
    </>
  );
}
