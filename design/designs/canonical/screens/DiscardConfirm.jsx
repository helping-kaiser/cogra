/* DISCARD THIS REPLY? (legacy conversion, lane C) — the one ask the wizard's X
   raises, and only where leaving costs something. The post wizard keeps its
   draft and leaves silently; a reply and a comment edit keep nothing, so a
   composer with words in it stops to check (`WizardHeader`'s two ways out).

   THE SAFE ACTION IS THE FILLED ONE everywhere else in the system — and here it
   is not. Keeping the words is what the reader almost always wants, but
   `Discard` is the answer the dialog was raised to ask for, and the words above
   it say plainly what it costs. Preserved as drawn; whether this dialog should
   follow `RemoveConfirm`'s weighting is a drawing question the round leaves
   open.

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
            <Button variant="text">Keep writing</Button>
            <Button>Discard</Button>
          </div>
        </div>
      </DialogSurface>
    </>
  );
}
