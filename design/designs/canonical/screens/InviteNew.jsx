/* NEW INVITE — the create sheet, over the list. Two decisions, one button, and
   nothing else on it.

   THE SHEET IS `NewInviteSheet`, in `_shared.jsx`: the expiry chooser opens
   over this same sheet and both boards have to agree about what it holds.

   NO STANCE CONTROL ANYWHERE, and that is a ruling rather than an omission.
   A link used to carry pre-filled stance values for the issuer's eventual
   Opinion; the prefill is gone from the whole mechanic. It was a number chosen
   before there was anybody to have an opinion about, asked at the moment a
   reader knows least and answered again at approval anyway — and a control
   that stages a value nothing commits to is the opposite of what the pad is
   for. The opinion is picked once, on the pad, when the person exists.

   WHAT A SHEET COVERS IS INERT, NOT SHORTENED — the whole list stands beneath
   it, which is what the board's `scanExempt` line says. */
export function Screen() {
  return (
    <>
      <InvitesBody />
      <NewInviteSheet />
    </>
  );
}
