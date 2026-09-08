/* THE LICENSE SHEET, over the seal (legacy conversion, the conformance
   round): the terms anyone reusing this post is held to, declared before the
   post is signed. The screen beneath is inert while the sheet is up.

   IT IS NOT `LicenseChooser`'s LAYOUT, BUT IT IS ITS WORDS. The master draws
   the two axes as a wrapped row of native radios — a form control for a
   settings page — where this sheet is the author's decision surface: one axis
   per section, one reading per row, and the consequence of each reading spelled
   at the end of its own line. The shape is the sheet's; the readings and their
   hints are `ATTRIBUTION_TIERS` and `PROVENANCE_TIERS`, so what a license
   promises is written once and this board cannot say a shorter version of it.

   THE ROW IS THE CONTROL, the way `Checkbox` makes it one: a real radio input,
   visually hidden, with the drawn dot and the words inside the label that names
   it. The dot was a span that nothing could reach or press.

   THE SEAL BENEATH IS THE SEAL — `ComposeSealBody`, the same body
   `ComposeSeal` draws. What a sheet covers is inert, not shortened. */

function AxisLabel({ children }) {
  return (
    <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", fontWeight: "var(--text-label-small--font-weight)", letterSpacing: "0.5px", color: "var(--text-secondary)" }}>
      {children}
    </span>
  );
}

function Axis({ axis, name, tiers, chosen }) {
  return (
    <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {tiers.map((tier, index) => (
        /* The ROW carries the flow number, not the input inside it: a visually
           hidden radio cannot show a badge, and the row is what a reader
           presses. */
        <label key={tier.label} data-axis={axis} className="cg-state cg-focus" style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 24, position: "relative", cursor: "pointer", borderRadius: "var(--radius-small)" }}>
          <input
            type="radio"
            name={name}
            defaultChecked={index === chosen}
            style={{ position: "absolute", opacity: 0, width: "1px", height: "1px", margin: 0 }}
          />
          <span
            aria-hidden="true"
            style={{
              width: 18,
              height: 18,
              flex: "none",
              boxSizing: "border-box",
              borderRadius: "var(--radius-full)",
              border: index === chosen ? "5px solid var(--primary)" : "1px solid var(--border-field)",
            }}
          />
          <span style={{ flex: 1, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", letterSpacing: "var(--text-body-medium--letter-spacing)" }}>
            {tier.label}
          </span>
          <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", letterSpacing: "var(--text-body-small--letter-spacing)", color: "var(--text-secondary)" }}>
            {tier.hint}
          </span>
        </label>
      ))}
    </div>
  );
}

export function Screen() {
  return (
    <>
      <ComposeSealBody />

      <BottomSheet open ariaLabel="License terms">
        <SheetTitle trailing={<HelpDot ariaLabel="License" />}>License</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 24px" }}>
          <QuietNote>Terms for anyone who reuses this.</QuietNote>

          <AxisLabel>Credit</AxisLabel>
          <Axis axis="credit" name="license-attribution" tiers={ATTRIBUTION_TIERS} chosen={2} />

          <AxisLabel>Public record of use</AxisLabel>
          <Axis axis="record" name="license-provenance" tiers={PROVENANCE_TIERS} chosen={0} />

          <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border-hairline)", paddingTop: 10 }}>
            <span style={{ flex: 1, fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", letterSpacing: "var(--text-body-small--letter-spacing)", color: "var(--text-secondary)" }}>
              Credit always — every use credits you.
            </span>
            <Button>Done</Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
