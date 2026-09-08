/* DISCARD THIS REPLY? (legacy conversion, lane C) — the one ask the wizard's X
   raises, and only where leaving costs something. The post wizard keeps its
   draft and leaves silently; a reply and a comment edit keep nothing, so a
   composer with words in it stops to check (`WizardHeader`'s two ways out).

   THE SAFE ACTION IS THE FILLED ONE, as it is everywhere else in the system —
   `RemoveConfirm`'s weighting. A think-twice dialog exists to make the costly
   answer deliberate, so the destructive word stays quiet and the way back
   carries the weight; a filled Discard would hand the heaviest control on the
   board to the answer the dialog was raised to slow down.

   THE COMPOSER BENEATH IS `ReplyDraft`, the same body `ReplyCompose` draws, so
   the dialog sits over the real stage rather than a copy of it. */
export function Screen() {
  return (
    <>
      <ReplyDraft />
      <DialogSurface ariaLabel="Discard this reply?" width="21rem">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)" }}>
            Discard this reply?
          </h2>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>Nothing is kept.</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="text">Discard</Button>
            <Button>Keep writing</Button>
          </div>
        </div>
      </DialogSurface>
    </>
  );
}
