/* THE DRAFT'S DISCARD, ASKED FROM THE ROLL (jakob 2026-09-15: "i guess clicking
   the images should also start the discard process (open the popup).. else
   people might just click the images and wonder why nothing happens").

   IT EXISTS BECAUSE A BLOCKED SURFACE OWES AN ANSWER. Under an unanswered draft
   the roll is dimmed and out of reach, which is the correct state and a silent
   one: a reader who taps a picture gets nothing back, and has to work out for
   themselves that the card above is the reason. This dialog is that answer,
   raised by the tap itself, and it says the thing the reader was missing —
   picking pictures means starting a new post, and this draft is what stands in
   the way of one.

   SO THE TAP LANDS ON THE DISCARD, NOT ON THE DRAFT. Reaching for the roll is
   reaching past the draft, and the dialog asks about exactly that; the way back
   into the draft is the card's own `Continue`, which is on the screen behind
   this and is where a reader who changes their mind is returned.

   THE SAFE ACTION IS THE FILLED ONE — `DiscardConfirm`'s weighting and §11's
   rule. A think-twice dialog exists to make the costly answer deliberate, so
   the destructive word stays a quiet text button and the right-hand slot the
   thumb goes to by habit carries the answer that keeps the work. No `error`
   colour: a reader discarding a draft they no longer want is doing what they
   meant to (`RemoveConfirm`'s close, the same day).

   THE DESTRUCTIVE WORD TAKES ITS OBJECT, and the safe one does too. The card
   behind the scrim carries a bare `Discard` of its own, inert under the wash;
   two buttons reading the same single word on one screen, only one of them
   live, is the ambiguity a dialog is supposed to remove. `Discard it` and `Keep
   the draft` cannot be misread against it.

   THE SCRIM IS THE THIRD ANSWER, unspelled: a reader who tapped a picture by
   accident dismisses this and stands exactly where they were, draft intact.

   THE STAGE BENEATH IS `ComposeDraftBody`, the same body `ComposeDraft` draws,
   so the dialog sits over the real screen rather than a copy of it — and every
   control under the wash is wired on that board. */
export function Screen() {
  return (
    <>
      <ComposeDraftBody />
      <DialogSurface ariaLabel="Discard your draft?">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)" }}>
            Discard your draft?
          </h2>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            Picking pictures starts a new post, and this draft is what stands in the way. Discarding is the only thing
            that loses it.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="text">Discard it</Button>
            <Button>Keep the draft</Button>
          </div>
        </div>
      </DialogSurface>
    </>
  );
}
