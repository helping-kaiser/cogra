/* MARK AS SENSITIVE, over the seal (legacy conversion, the conformance
   round): the sheet the seal's "Mark" opens. The screen beneath is inert while
   it is up — the sheet and its scrim are the only live things — which is what
   the board's `scanExempt` line says.

   THE SEAL BENEATH IS THE SEAL — `ComposeSealBody`, the same body
   `ComposeSeal` draws. What a sheet covers is inert, not shortened.

   THE SWITCH IS DRAWN ON THIS BOARD, and it is a real one — `role="switch"`
   with its state on it. The system has no switch master: this is the only one
   in it, and one instance is a control, not a component.

   THE HEADING ROW IS `SheetTitle`, and the "?" and the switch ride its
   `trailing` slot — the name and what the line carries besides it. */
export function Screen() {
  return (
    <>
      <ComposeSealBody />

      <BottomSheet open ariaLabel="Mark as sensitive">
        <SheetTitle
          trailing={
            <>
              <HelpDot ariaLabel="Sensitive" />
              <button
                type="button"
                role="switch"
                aria-checked="true"
                aria-label="Mark as sensitive"
                className="cg-state cg-focus cg-hit"
                style={{ position: "relative", width: 44, height: 24, flex: "none", border: 0, padding: 0, borderRadius: "var(--radius-full)", background: "var(--primary)", cursor: "pointer" }}
              >
                <span aria-hidden="true" style={{ position: "absolute", right: 3, top: 3, width: 18, height: 18, borderRadius: "var(--radius-full)", background: "var(--on-primary)" }} />
              </button>
            </>
          }
        >
          Mark as sensitive
        </SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 24px" }}>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", letterSpacing: "var(--text-body-medium--letter-spacing)" }}>
            Veils the pictures and the description until a reader chooses to look.
          </p>

          <TextField label="Why?" corner="Optional — shown on the veil" value="One rubbing includes a dead seabird." />

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button>Done</Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
