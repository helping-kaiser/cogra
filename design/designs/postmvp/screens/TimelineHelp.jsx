/* THE TIMELINE'S "?" DIALOG — `How opinions build`, opened over the
   person↔person timeline (jakob's canvas review, 2026-09-23).

   IT IS `HelpDialog`'S SHAPE, one topic over: a heading naming the thing asked
   about, prose, and one way out. No links, no second action, nothing to decide —
   a "?" that led somewhere would be a navigation the reader did not ask for.

   THE COPY SAYS THE THREE THINGS THE SHEET SHOWS AND NOBODY GUESSES: that an
   opinion is the sum of every signed pick, read row by row beneath; that the sum
   keeps counting past the dial, so a long history outweighs any one pick and
   walking it back takes as many; and that walking back is one more signed
   record rather than a deletion. It is THREE paragraphs where the "?" dialogs
   hold to two (`copy-voice.md`), because each of the three is a fact on its
   own — drafted for jakob's review, and flagged there rather than trimmed here.

   THE SURFACE BENEATH IS `PersonTimeline`, the timeline's real drawing — the
   opinions page, the sheet's wash and the sheet — for `HelpDialog`'s reason: the
   reader opened this from a surface they can still see. Two washes stack, the
   way `ReplyPadHelp`'s do. The post timeline's "?" opens this same dialog over
   its own sheet; one board draws it, because the words do not change with the
   target.

   THE DIALOG IS LIFTED ONE LAYER. A dialog's scrim sits on the layer a sheet's
   wash does, and the sheet's surface rides one above that — so, left alone, the
   sheet would paint over the dialog opened from it. The wrapper puts the dialog
   and its scrim above the whole sheet, which is where a modal opened from a
   drawer belongs. */
export function Screen() {
  return (
    <>
      <PersonTimeline />

      <div style={{ position: "relative", zIndex: 50 }}>
        <DialogSurface ariaLabel="How opinions build">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)" }}>
              How opinions build
            </h2>
            <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
              An opinion is not one number — it is every pick ever signed from one side toward the other, added up. Each row here is one
              signed pick, exactly as it was made.
            </p>
            <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
              The dial only reaches so far, but the sum underneath keeps counting. A long history can weigh far more than any one pick can
              move — which is why walking something back takes as many picks as building it did.
            </p>
            <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
              Walking back is not deleting. A pick in the other direction is one more signed record, and the whole history stays readable,
              right here.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button>Close</Button>
            </div>
          </div>
        </DialogSurface>
      </div>
    </>
  );
}
