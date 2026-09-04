/* THE LICENSE SHEET, over the seal (legacy conversion, the conformance
   round): the terms anyone reusing this post is held to, declared before the
   post is signed. The screen beneath is inert while the sheet is up.

   IT IS NOT `LicenseChooser`. The master is the same two axes with the same
   three named readings each, and it draws them as a wrapped row of native
   radios with no hints — a form control for a settings page. This sheet is the
   author's decision surface: one axis per section, one reading per row, and
   the consequence of each reading spelled at the end of its own line, which is
   the half a chooser without hints leaves the author to guess. Forcing the
   master here would delete six lines of copy and reflow the sheet; forcing the
   sheet's shape into the master would make one board the owner of a component
   four surfaces share. So the rows are drawn here, and the divergence is
   reported rather than papered over.

   THE ROW IS THE CONTROL, the way `Checkbox` makes it one: a real radio input,
   visually hidden, with the drawn dot and the words inside the label that names
   it. The dot was a span that nothing could reach or press. */

const CREDIT = [
  { label: "No credit", hint: "Nobody owes you a name." },
  { label: "Credit commercially", hint: "Commercial uses credit you." },
  { label: "Credit always", hint: "Every use credits you." },
];

const RECORD = [
  { label: "No record", hint: "Uses go unlogged." },
  { label: "Record commercially", hint: "Commercial uses are logged." },
  { label: "Record always", hint: "Every use is logged publicly." },
];

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
      <WizardHeader title="What you sign" stageLabel="Last step" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuietNote>Salt maps of the coast road — 2 pictures.</QuietNote>
        <ActsCard total="4 signed actions" note="they land together, or none does" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <FactRow label="License" value="Public domain — your default" action="Change" />
          <FactRow
            label="Where you stand on it"
            value={<StanceReadout pair={{ pDirected: 0.1, pInterest: 0.1 }} />}
            action="Adjust"
            last
          />
        </div>
        <div style={{ flex: 1 }} />
        <Button style={{ width: "100%" }}>Sign and publish</Button>
      </div>

      <BottomSheet open ariaLabel="License terms">
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: 0, flex: 1, fontSize: "var(--text-title-large)", lineHeight: "var(--text-title-large--line-height)", fontWeight: "var(--text-title-large--font-weight)" }}>
              License
            </h2>
            <HelpDot ariaLabel="License" />
          </div>
          <QuietNote>Terms for anyone who reuses this.</QuietNote>

          <AxisLabel>Credit</AxisLabel>
          <Axis axis="credit" name="license-attribution" tiers={CREDIT} chosen={2} />

          <AxisLabel>Public record of use</AxisLabel>
          <Axis axis="record" name="license-provenance" tiers={RECORD} chosen={0} />

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
