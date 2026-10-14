/* DISCARD THIS REPLY? (legacy conversion, lane C) — the one ask the wizard's X
   raises, and only where leaving costs something. The post wizard keeps its
   draft and leaves silently; a reply, a comment edit and a post edit keep
   nothing, so a composer with words in it, or an edit changed since it
   opened, stops to check (`WizardHeader`'s two ways out). The edits ask
   `Discard the changes?` over the same `Nothing is kept.` — the board draws
   the reply's title (the post edit's ask, jakob 2026-10-14).

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
