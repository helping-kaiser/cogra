/* THE SEAL WITH NO KEY ON THIS BROWSER (legacy conversion, the conformance
   round). Everything the signature would commit is still read back — the draft
   is not the thing that is missing — and the one act the surface cannot
   perform is replaced by the way to get it back.

   THE NOTICE IS `WalletKeyAbsent`'s, which is the same fact on the wallet: a
   `tertiary-container` panel, and the restore button in `Button`'s `inverse` —
   the filled button that takes the panel's own pair turned over instead of a
   `primary` fill arguing with it.

   THE PANEL'S "?" IS DRAWN HERE, not `HelpDot`. The master spends `--primary`
   on the glyph and `--border-hairline` on its ring, which is right on the
   page's ground and is a second colour family inside a tonal block. The ring
   here is the panel's own `currentColor`, at the master's geometry — 32px of
   ring inside the 48px target.

   NO SIGN BUTTON, so no `SealFooter`: the pair that footer draws is commit and
   the way back, and there is nothing to commit until the key is here. What
   ends the column instead is the way out that keeps the draft. */
export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" stageLabel="Last step" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuietNote>Salt maps of the coast road — 2 pictures.</QuietNote>

        <ActsCard
          rows={[
            { label: "Post", value: "Salt maps of the coast road", count: "1 action" },
            {
              label: "Topics",
              value: (
                <span style={{ display: "flex", gap: 6, overflow: "hidden", alignItems: "center" }}>
                  <Chip label="#fieldnotes" tone="readout" />
                  <Chip label="#coastroad" tone="readout" />
                </span>
              ),
              count: "2 actions",
            },
            { label: "References", value: "The long way home — @ada", count: "1 action" },
          ]}
          total="4 signed actions"
          note="they land together, or none does"
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <FactRow label="License" value="Public domain — your default" action="Change" last />
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 12, borderRadius: "var(--radius-medium)", background: "var(--tertiary-container)", color: "var(--on-tertiary-container)", padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: 0, flex: 1, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>
              Your key isn't on this browser
            </h2>
            <button
              type="button"
              aria-label="Your key"
              className="cg-focus"
              style={{ display: "grid", placeItems: "center", height: "var(--touch-target-min)", width: "var(--touch-target-min)", border: 0, background: "none", borderRadius: "var(--radius-full)", cursor: "pointer", flex: "none", color: "inherit" }}
            >
              <span
                aria-hidden="true"
                style={{ display: "grid", placeItems: "center", height: 32, width: 32, borderRadius: "var(--radius-full)", border: "1px solid currentColor", fontFamily: "var(--font-sans)", fontSize: "var(--text-label-large)", fontWeight: "var(--text-label-large--font-weight)" }}
              >
                ?
              </span>
            </button>
          </div>
          <Button variant="inverse" style={{ width: "100%" }}>Restore the key</Button>
        </div>

        <Button variant="text" style={{ width: "100%" }}>Keep the draft, restore later</Button>
      </div>
    </>
  );
}
