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
      <DialogSurface
        onScrimPress={() => {}}
        title="Discard this reply?"
        body="Nothing is kept."
        actions={
          <>
            <Button variant="text">Discard</Button>
            <Button>Keep writing</Button>
          </>
        }
      />
    </>
  );
}
