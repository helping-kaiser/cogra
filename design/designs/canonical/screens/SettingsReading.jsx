/* WHAT YOUR FEED SHOWS, over the settings page (readme §13, the settings
   round; jakob's review 2026-09-09). What the Reading group's row opens: the
   default every feed opens with, set in the feed's own control.

   ONE CONTROL, TWO ENDS OF ONE PROMISE. The filter's help text has always said
   *Your default lives in settings*, and the feed's own snackbar says a change
   made there *lasts until you change it, on this device only*. This is the
   other end, and it is the same sheet — `FeedFilterSheet`, the half of
   `FeedFilter` that is not the pill. A settings page that redrew the ten kinds
   in rows of its own would be a second filter to keep in step with the first.

   THE ROW IS THE TRIGGER. Search takes `FilterTrigger` because it owns its
   sheet; settings takes the sheet because it owns its trigger — the row reads
   the current default back in the pill's own words (`Posts`), so the row and
   the sheet cannot say different things.

   IT IS TITLED, AND THE FEED'S IS NOT. This sheet covers the surface it was
   opened from, so it has to name itself; the feed's pill is a thumb away and
   still on screen. The "?" moves with the title onto its own row, which is
   `SheetTitle`'s rule for a sheet that has one.

   THE ORDER SECTION IS DRAWN AT ITS DESIGNED DEFAULT, `Ranked`. §13's standing
   ruling — the filter honestly reads Newest until slice 3's ranker ships —
   binds the shipped label to the shipped behaviour, and it binds this row too:
   until the ranker lands, the default an account starts from is Newest and the
   sheet says so. The canvas draws the destination; the register carries the
   obligation, so implementation cannot read Ranked here as permission to
   promise it. */
export function Screen() {
  return (
    <>
      <SettingsBody />

      <FeedFilterSheet
        open
        ariaLabel="What your feed shows"
        lead={
          <>
            <SheetTitle trailing={<HelpDot ariaLabel="How the filter works" />}>What your feed shows</SheetTitle>
            <div style={{ padding: "0 var(--space-6) var(--space-4)" }}>
              <QuietNote>Every feed starts from this.</QuietNote>
            </div>
          </>
        }
      />
    </>
  );
}
