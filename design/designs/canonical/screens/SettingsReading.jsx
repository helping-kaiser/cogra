/* WHAT YOUR FEED SHOWS, over the settings page (readme §13, the settings
   round; jakob's review 2026-09-09). What the Reading group's row opens: the
   default every feed opens with, set in the feed's own control.

   ONE CONTROL, TWO ENDS OF ONE PROMISE. The filter's help text sends the
   reader here to change their defaults, and the feed's own snackbar says a change
   made there *lasts until you change it, on this device only*. This is the
   other end, and it is the same sheet — `FeedFilterSheet`, the half of
   `FeedFilter` that is not the pill. A settings page that redrew the kinds
   in rows of its own would be a second filter to keep in step with the first.

   THE ROW IS THE TRIGGER. Search takes `FilterTrigger` because it owns its
   sheet; settings takes the sheet because it owns its trigger — the row reads
   the current default back in the pill's own words (`Posts`), so the row and
   the sheet cannot say different things.

   IT IS TITLED, AND THE FEED'S IS NOT. This sheet covers the surface it was
   opened from, so it has to name itself; the feed's pill is a thumb away and
   still on screen. The "?" moves with the title onto its own row, which is
   `SheetTitle`'s rule for a sheet that has one.

   IT COMMITS ON DONE, LIKE EVERY SHEET (the sheet law, readme §4, *Sheets*).
   Chips stage; `Done` saves the default and the row reads it back; the scrim,
   a swipe down and Back discard, and the default is what it was — the way
   `SettingsLicense` leaves it. The foot is `FilterFoot`, every filter sheet's
   one row: a hairline, `Reset` in the corner, `Done` at the end, inside the
   sheet's own inset. The row that opened this sheet reads the default back in
   the pill's word, `Posts`, once Done has saved it.

   HERE `Reset` MEANS COGRA'S DEFAULT (jakob 2026-10-02, pass C 10). On a
   feed's sheet `Reset` stages the reader's own default; this sheet is where
   that default is set, so its `Reset` stages the app's — the one place a
   reader gets back to CoGra's defaults. Done saves it as theirs.

   THE FOOT IS PINNED AND THE SECTIONS SCROLL. Four sections already outrun the
   sheet's 88%, so a commitment placed after them would be the one control a
   reader has to scroll to find. `FeedFilterSheet` takes the height when it is
   given a foot.

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
        foot={<FilterFoot />}
      />
    </>
  );
}
