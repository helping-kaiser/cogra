/* THE DEFAULT LICENSE, over the settings page (readme §13, the settings round;
   jakob's review 2026-09-09). What the Writing group's Default license row
   opens — the account preference `api-spec.md` carries as
   `UserPreferences.defaultLicense`.

   IT EXISTS BECAUSE THE ROW HAD NOWHERE TO GO. The round pointed this row at
   the seal's own sheet and called that one license surface. It is one control,
   but it is not one board: the seal's sheet is drawn over the post being
   signed, and this one is drawn over settings, where the same three-by-three
   question means something else. A canvas that leaves the difference undrawn
   leaves it to be guessed.

   THE ANATOMY IS `ComposeLicense`'s, and where the two sheets are the same
   question they are the same pixels: `LicenseAxis` draws both, from
   `ATTRIBUTION_TIERS` and `PROVENANCE_TIERS`, so a reading cannot promise one
   thing to an author and another to an account.

   WHAT DIFFERS IS THE READING, AND IT IS THE WHOLE POINT. The seal's note is
   written for the post in front of it. This one sets where every new post
   STARTS and binds nothing: a post's terms settle at its genesis signing, so
   changing this never reaches anything already published. That is the
   contract's own wording, said to a reader.

   IT IS TITLED BY THE ROW THAT OPENED IT. A sheet that covers the surface it
   came from has to say what it is; the seal's sheet does not, because the
   composer is still visible around it. The title is the row's own words, so
   the two cannot drift — the same rule the Reading row keeps with the filter's
   accessible name.

   `Done` COMMITS IT, the way the seal's does and the Reading row's sheet does —
   a staging sheet carries a commit, and the scrim, a swipe down, system Back and Escape discard
   (the sheet law, readme §4, *Sheets*). The foot reads `licenseSummary`, the
   one joining rule the seal's row reads too.

   REGISTERED under the `settings` prefix (design ⇄ impl seam 082, the
   settings packet): the body names its parts as on `Settings`, and the sheet
   is `licenseSheet`, named for the row that opens it as `SettingsHidden`'s is —
   its `title` with the `help` on it, the `note`, each axis by its own name
   (`credit`, `record`) beside its `creditLabel` / `recordLabel`, a reading's
   row `tier` keyed by its position, and the `foot` with its `summary` and
   `done`. */
export const NODE = "settings";
export function Screen() {
  return (
    <>
      <SettingsBody />

      <BottomSheet open ariaLabel="Default license" maxHeight="88%" node="licenseSheet">
        <SheetTitle trailing={<HelpDot ariaLabel="License" node="help" />} node="title">Default license</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 24px" }}>
          <QuietNote node="note">
            Where every new post starts. A post's terms settle when it is first signed, so changing
            this never reaches one you have already published.
          </QuietNote>

          <LicenseAxisLabel node="creditLabel">Credit</LicenseAxisLabel>
          <LicenseAxis axis="credit" name="default-license-attribution" tiers={ATTRIBUTION_TIERS} chosen={0} node="credit" />

          <LicenseAxisLabel node="recordLabel">Public record of use</LicenseAxisLabel>
          <LicenseAxis axis="record" name="default-license-provenance" tiers={PROVENANCE_TIERS} chosen={0} node="record" />

          <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border-hairline)", paddingTop: 10 }} data-node="foot">
            <span style={{ flex: 1, fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", letterSpacing: "var(--text-body-small--letter-spacing)", color: "var(--text-secondary)" }} data-node="summary">
              <LicenseSummary />
            </span>
            <Button node="done">Done</Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
