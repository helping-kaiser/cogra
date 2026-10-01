/* THE LICENSE SHEET, over the seal (legacy conversion, the conformance
   round): the terms anyone reusing this post is held to, declared before the
   post is signed. The screen beneath is inert while the sheet is up.

   IT IS NOT `LicenseChooser`'s LAYOUT, BUT IT IS ITS WORDS. The master draws
   the two axes as a wrapped row of native radios — a form control for a
   settings page — where this sheet is the author's decision surface. The rows
   are `LicenseAxis` in `_shared.jsx`, shared with the account default's sheet;
   the readings and their hints are `ATTRIBUTION_TIERS` and `PROVENANCE_TIERS`,
   so what a license promises is written once and this board cannot say a
   shorter version of it.

   THE NOTE IS WRITTEN FOR ONE POST. *Terms for anyone who reuses this* is about
   the thing being signed, and it stays here: the settings route sets what a new
   post starts from and says so in its own words, on its own board.

   THE RADIOS STAGE, AND `Done` COMMITS (the sheet law, readme §4, *Sheets*).
   A pick changes the sheet and nothing else; `Done` carries the pair to the
   seal's row; the scrim, a swipe down and Back discard it, and the post's
   terms are what they were.

   THE FOOT AND THE ROW READ ONE SENTENCE. `licenseSummary` joins the pair's
   name and both tier hints — drawn here at `Credit always` / `Not logged` —
   and the seal's License row reads the same sentence for whatever pair the
   post carries, so the sheet shows what Done will put on the row.

   THE SEAL BENEATH IS THE SEAL — `ComposeSealBody`, the same body
   `ComposeSeal` draws. What a sheet covers is inert, not shortened. */

export function Screen() {
  return (
    <>
      <ComposeSealBody />

      <BottomSheet open ariaLabel="License terms" maxHeight="88%">
        <SheetTitle trailing={<HelpDot ariaLabel="License" />}>License</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 24px" }}>
          <QuietNote>Terms for anyone who reuses this.</QuietNote>

          <LicenseAxisLabel>Credit</LicenseAxisLabel>
          <LicenseAxis axis="credit" name="license-attribution" tiers={ATTRIBUTION_TIERS} chosen={2} />

          <LicenseAxisLabel>Public record of use</LicenseAxisLabel>
          <LicenseAxis axis="record" name="license-provenance" tiers={PROVENANCE_TIERS} chosen={0} />

          <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border-hairline)", paddingTop: 10 }}>
            <span style={{ flex: 1, fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", letterSpacing: "var(--text-body-small--letter-spacing)", color: "var(--text-secondary)" }}>
              <LicenseSummary license={{ attribution: 1, provenance: 0 }} />
            </span>
            <Button>Done</Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
