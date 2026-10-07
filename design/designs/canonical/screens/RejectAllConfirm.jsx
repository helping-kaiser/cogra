/* CLOSING A WHOLE LINK'S APPLICATIONS — the think-twice dialog behind a
   group's `Close all` (jakob 2026-09-15, on a bot burst: "we add batching..
   batched by invite link?").

   IT IS `RejectConfirm` WITH A NUMBER, and that is the whole difference. Same
   dialog shape, same two halves — the rows leave your list, the people are
   told — same safe-action-filled weighting, same absence of deletion language,
   because closing four applications destroys exactly as much as closing one,
   which is nothing.

   THE COUNT IS IN THE TITLE, because the count IS the risk. A reader who
   presses `Close all` on a burst knows what they meant; a reader who presses it
   on the wrong group does not, and the only thing that tells them apart is the
   number they are about to act on. It names the link too — `from this link` —
   since the group is the unit and the reader may have two links in flight.

   IT NAMES NO HANDLES. Four is a list, twelve is a wall, and a dialog that
   grows with the burst is a dialog that stops being readable exactly when the
   burst is worst. The names are on the rows behind it; what this surface owes
   is the shape of the act, not an inventory.

   THE SWEEP SKIPS WHAT IS ALREADY CLOSED, which is why the count and the
   sentence both say WAITING. A closed application is not closed twice and an
   approved one is not in the queue, so the number the dialog names is the
   number that changes.

   AND IT IS STILL NOT A VERDICT. Every one of these people keeps the account
   they made, keeps reading, and can be vouched in by any member — the same
   sentence the single close carries, in the plural, because closing more of
   them at once does not make it mean more.

   REGISTERED under the `invites` prefix (design ⇄ impl seam 078), named as
   `RejectConfirm` names its dialog. */
export const NODE = "invites";
export function Screen() {
  return (
    <>
      <InvitesBody />

      <DialogSurface
        node="dialog"
        onScrimPress={() => {}}
        title="Close all 4 applications from this link?"
        body={[
          "All four leave your list and all four people are told. Their accounts stay exactly as they are — signed in, and free to keep reading.",
          "This is your call and nobody else's. Any member can still vouch any of them in, and each gets a link to ask with.",
        ]}
        actions={
          <>
            <Button variant="text" node="close">Close them</Button>
            <Button node="keep">Keep them</Button>
          </>
        }
      />
    </>
  );
}
