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

   `Done` CLOSES IT, the way the seal's does — and the way the Reading row's
   sheet does. Over settings nothing reacts behind a sheet to be watched, so
   both of the page's sheets commit rather than apply live; the feed's own
   filter is the one that can be watched, and it is the one with no `Done`. */
export function Screen() {
  return (
    <>
      <SettingsBody />

      <BottomSheet open ariaLabel="Default license">
        <SheetTitle trailing={<HelpDot ariaLabel="License" />}>Default license</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 24px" }}>
          <QuietNote>
            Where every new post starts. A post's terms settle when it is first signed, so changing
            this never reaches one you have already published.
          </QuietNote>

          <LicenseAxisLabel>Credit</LicenseAxisLabel>
          <LicenseAxis axis="credit" name="default-license-attribution" tiers={ATTRIBUTION_TIERS} chosen={0} />

          <LicenseAxisLabel>Public record of use</LicenseAxisLabel>
          <LicenseAxis axis="record" name="default-license-provenance" tiers={PROVENANCE_TIERS} chosen={0} />

          <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border-hairline)", paddingTop: 10 }}>
            <span style={{ flex: 1, fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", letterSpacing: "var(--text-body-small--letter-spacing)", color: "var(--text-secondary)" }}>
              Public domain — nobody owes you a name, and uses go unlogged.
            </span>
            <Button>Done</Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
