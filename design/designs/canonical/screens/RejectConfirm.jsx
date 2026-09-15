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
   product already lets anyone do — and the second sentence says so plainly,
   because a reader about to press this will otherwise assume they are
   throwing someone out.

   THE WAY BACK IS NAMED. A fresh link puts the same person back in this list,
   so the decision is reversible by a route the reader can picture — which is
   the honest alternative to an Undo the mechanic cannot offer.

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
          Their account stays exactly as it is — signed in, and free to keep reading. The application just stops waiting on you.
        </p>
        <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
          A fresh invite link puts them back in this list.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="text">Close it</Button>
          <Button>Keep it</Button>
        </div>
      </DialogSurface>
    </>
  );
}
