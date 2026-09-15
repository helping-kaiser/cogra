/* CLOSING AN APPLICATION — the think-twice dialog behind a row's close.

   THE SAFE ACTION IS THE FILLED ONE, in the right-hand slot the thumb goes to
   by habit; `Close it` stays a text button on the left. The destructive-dialog
   rule (§11), and the act is still one tap away.

   NO `error` COLOUR. §11 rules a destructive dialog takes no new colour, and
   `SeveranceConfirm` says the same in its own words — walking something back
   is a deliberate choice, not a fault. Here it is doubly true: nothing is
   destroyed at all.

   NO DELETION LANGUAGE, BECAUSE THERE IS NO DELETION. Closing an application
   removes nothing and touches nothing on the record: the applicant staged
   service-side and nothing reached the graph before approval
   (`invitations.md` §4), so there is no act to undo and no mark to leave. What
   changes is that the application stops waiting on the reader. The person
   keeps the account they made and keeps reading with it, which the whole
   product already lets anyone do.

   IT IS THIS READER'S REFUSAL AND NOT A VERDICT (jakob 2026-09-15). The
   dialog has to say both halves or it says the wrong thing: the row leaves
   YOUR list, and the person is TOLD — those are the two effects, and a reader
   who is not told that the person hears about it is being let to press this
   as though it were private. Then the half that keeps it from reading as
   expulsion: any other member can still vouch them in, and they are handed a
   link to ask with. One person declining to vouch is one person declining to
   vouch, and the copy is what stops the product from making it mean more.

   IT NAMES THE PERSON, and it names `@imke` — the row whose application is
   not even ready yet, which is the one a reader is likeliest to close. One
   dialog serves both rows; the close control is one control drawn twice, so
   one edge covers it. */
export function Screen() {
  return (
    <>
      <InvitesBody />

      <DialogSurface ariaLabel="Close @imke's application?" width="22rem">
        <h2 style={{ margin: 0, fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)" }}>
          Close @imke's application?
        </h2>
        <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
          It leaves your list and @imke is told. Their account stays exactly as it is — signed in, and free to keep reading.
        </p>
        <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
          This is your call and nobody else's. Any member can still vouch them in, and @imke gets a link to ask with.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="text">Close it</Button>
          <Button>Keep it</Button>
        </div>
      </DialogSurface>
    </>
  );
}
