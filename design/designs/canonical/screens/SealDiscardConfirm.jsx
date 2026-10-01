/* DISCARD THIS POST? (jakob 2026-10-01, the bug register's third way out) —
   the ask `Discard the post` raises on `SealFaultBug`. Losing a draft is
   costly and cannot be undone, so it asks first: the undo-vs-confirm rule
   (§11, *Dialogs*), at post scale over the seal.

   IT IS THE DRAFT DISCARD'S DIALOG, RAISED FROM THE SEAL. `DiscardConfirm` asks
   at reply scale and `ComposeDraftDiscard` asks from the roll, where its words
   are about picking pictures; neither says what discarding from the seal
   means, so this board says it — the whole post goes, with what it cited and
   tagged, and nothing was ever signed.

   THE SAFE ACTION IS THE FILLED ONE — `DiscardConfirm`'s weighting and §11's
   rule — and both words take their object, `ComposeDraftDiscard`'s reason: the
   seal behind the scrim carries `Discard the post` of its own, inert under the
   wash. No `error` colour: a reader discarding a post they no longer want is
   doing what they meant to.

   THE STAGE BENEATH IS `ComposeSealBody` in its bug state, the same body
   `SealFaultBug` draws, so the dialog sits over the real screen. */
export function Screen() {
  return (
    <>
      <ComposeSealBody state="bug" />
      <DialogSurface ariaLabel="Discard this post?">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)" }}>
            Discard this post?
          </h2>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
            The draft goes, with its pictures, tags and citations. Nothing was signed, so nothing else changes.
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
