/* MARK AS SENSITIVE, over the seal (legacy conversion, the conformance
   round): the sheet the seal's "Mark" opens. The screen beneath is inert while
   it is up — the sheet and its scrim are the only live things — which is what
   the board's `scanExempt` line says.

   THE SEAL BENEATH IS THE SEAL — `ComposeSealBody`, the same body
   `ComposeSeal` draws. What a sheet covers is inert, not shortened.

   THE SWITCH IS THE MASTER — `Switch` from `SettingsRow.jsx`, built to this
   sheet's own geometry, so the settings page and this sheet cannot drift.

   THE HEADING ROW IS `SheetTitle`, and the "?" and the switch ride its
   `trailing` slot — the name and what the line carries besides it.

   ONE LINE FOR BOTH SCALES. The comment editor's Mark row opens this same
   sheet, so the explainer names what the veil covers on either — the pictures
   and the words. A comment has no description to name, and a post's
   description is words.

   THE REASON GROWS FROM ONE LINE (jakob's ruling, the sheets-and-video round).
   `rows={1}` is the field's minimum, not its size: a reason that runs past one
   line takes a second and the sheet grows with it, which is why a 140-character
   field is written as a multi-line one. The board draws the minimum.

   OVER THE CAP, `Done` IS VISIBLE-BUT-DISABLED (backlog item 101, ruled the
   batch-rulings round): the app-wide `canSign`/`canSubmit` treatment, never a
   hidden button and never a dialog. The refusal the reader reads is the
   reason field's own late counter — contractual on this field already
   (`TextField.prompt.md`, the capped-field rule, at the 140 this sheet
   passes) — and the closing word only stops being available. A `Done` that
   vanished would leave a reader hunting for the way out of a sheet they
   cannot leave. This board draws the at-rest state; the disabled one is this
   sentence, not a second board.

   `Mark` OPENS IT WITH THE SWITCH ON (jakob 2026-10-01): the tap was the
   intent, so the board draws the sheet as it opens. Switched off, the reason
   keeps its text but disables, and an off switch drops it at signing — the api
   refuses a reason without the mark.

   IT COMMITS ON `Done` (the sheet law, readme §4, *Sheets*). The switch and the
   reason stage; Done carries them to the seal's row (`Marked`); the scrim, a
   swipe down and Back discard, and the row is what it was.

   AT EDIT, A POST THE PLATFORM VEILED. The switch binds only the author's own
   mark (`sensitiveSelfMark`), never the moderator's verdict, so on a post the
   platform veiled and its author did not, the edit's Sensitive row reads `Not
   marked` with a quiet line under it — `Also veiled by the platform's
   verdict` — and the author is not left reading an off switch over a veiled
   post. The line is this sentence, not a second board. */
export function Screen() {
  return (
    <>
      <ComposeSealBody />

      <BottomSheet open ariaLabel="Mark as sensitive">
        <SheetTitle
          trailing={
            <>
              <HelpDot ariaLabel="Sensitive" />
              <Switch checked ariaLabel="Mark as sensitive" />
            </>
          }
        >
          Mark as sensitive
        </SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 24px" }}>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", letterSpacing: "var(--text-body-medium--letter-spacing)" }}>
            Veils the pictures and the words until a reader chooses to look.
          </p>

          <TextField label="Why?" corner="Optional — shown on the veil" rows={1} cap={140} value="One rubbing includes a dead seabird." />

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button>Done</Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
