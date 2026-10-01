/* THE SEAL WITH NO KEY ON THIS BROWSER (legacy conversion, the conformance
   round). Everything the signature would commit is still read back — the draft
   is not the thing that is missing — and the one act the surface cannot
   perform is replaced by the way to get it back.

   THE NOTICE IS `NoticePanel`, the tertiary notice's master, at the seal's
   `medium` corner beside the acts card: a `tertiary-container` panel, and the
   restore button in `Button`'s `inverse` — the filled button that takes the
   panel's own pair turned over instead of a `primary` fill arguing with it.

   THE PANEL'S "?" IS `HelpDot`'s `inverse`. On the page's ground the master
   spends `--primary` on the glyph and `--border-hairline` on its ring, which
   inside a tonal block is a second colour family; the variant rings in the
   panel's own `currentColor` at the same geometry — 32px inside the 48px
   target.

   TWO "?"s, BY THE STOPPER EXCEPTION (readme §13, *The failure fixes and the
   support stack*; jakob 2026-10-01), the treatment its reply-scale twin
   `ReplySealKeyAbsent` takes: the missing key stops the one act the seal
   exists for, so the notice carries its own "?", naming the key, beside the
   header's, which explains signing — the shape `WriteRuleFailed` draws.

   NO SIGN BUTTON, so no `SealFooter`: the pair that footer draws is commit and
   the way back, and there is nothing to commit until the key is here. What
   ends the column instead is the way out that keeps the draft. */
export function Screen() {
  return (
    <>
      <WizardHeader title="What you sign" stageLabel="Last step" help="How signing works" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuietNote>Salt maps of the coast road — 2 pictures.</QuietNote>

        <ActsCard
          rows={[
            { label: "Post", value: "Salt maps of the coast road", count: "1", countNoun: "post" },
            {
              label: "Tags",
              value: (
                <span style={{ display: "flex", gap: 6, overflow: "hidden", alignItems: "center" }}>
                  <Chip label="#fieldnotes" tone="readout" />
                  <Chip label="#coastroad" tone="readout" />
                </span>
              ),
              count: "2",
              countNoun: "tag",
            },
            { label: "References", value: "The long way home — @ada", count: "1", countNoun: "citation" },
          ]}
          total="4 things, signed together"
          note="They land together, or none does."
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <FactRow label="License" value={<LicenseSummary />} action="Change" last />
        </div>

        <div style={{ flex: 1 }} />

        <NoticePanel title="Your key isn't on this browser" helpLabel="Your key">
          <Button variant="inverse" style={{ width: "100%" }}>Restore the key</Button>
        </NoticePanel>

        <Button variant="text" style={{ width: "100%" }}>Keep the draft, restore later</Button>
      </div>
    </>
  );
}
