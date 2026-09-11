/* MARK AS SENSITIVE, over the seal (legacy conversion, the conformance
   round): the sheet the seal's "Mark" opens. The screen beneath is inert while
   it is up — the sheet and its scrim are the only live things — which is what
   the board's `scanExempt` line says.

   THE SEAL BENEATH IS THE SEAL — `ComposeSealBody`, the same body
   `ComposeSeal` draws. What a sheet covers is inert, not shortened.

   THE SWITCH IS THE MASTER — `Switch` from `SettingsRow.jsx`, built to this
   sheet's own geometry, so the settings page and this sheet cannot drift.

   THE HEADING ROW IS `SheetTitle`, and the "?" and the switch ride its
   `trailing` slot — the name and what the line carries besides it.

   ONE LINE FOR BOTH SCALES. The comment editor's Mark row opens this same
   sheet, so the explainer names what the veil covers on either — the pictures
   and the words. A comment has no description to name, and a post's
   description is words. */
export function Screen() {
  return (
    <>
      <ComposeSealBody />

      <BottomSheet open ariaLabel="Mark as sensitive">
        <SheetTitle
          trailing={
            <>
              <HelpDot ariaLabel="Sensitive" />
              <Switch checked ariaLabel="Mark as sensitive" />
            </>
          }
        >
          Mark as sensitive
        </SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 24px" }}>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", letterSpacing: "var(--text-body-medium--letter-spacing)" }}>
            Veils the pictures and the words until a reader chooses to look.
          </p>

          <TextField label="Why?" corner="Optional — shown on the veil" cap={140} value="One rubbing includes a dead seabird." />

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button>Done</Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
