/* INVITES — the live state (the invites round, 2026-09-15). What the Invites
   button on your own profile opens, and where the dot on that button sends a
   reader: the applications waiting and the links still usable, in that order.

   THE PAGE IS `InvitesBody`, in `_shared.jsx`: the create sheet, the expiry
   chooser, the fresh link, the approval pad and the reject dialog are all
   drawn over this same page. Six boards, one drawing.

   IT CARRIES NO BOTTOM BAR. `BottomNav`'s own rule names invites among the
   task flows — compose, profile edit, settings, key and auth — that take a
   `PageHeader` back arrow instead. The rule predates this round and this board
   keeps it: a surface a reader came to in order to finish something offers the
   way back, not four ways out.

   THE TWO HALVES MUST NOT LOOK ALIKE, and here they do not. Staging is free
   and revocable: a link is a thing the reader made and can un-make with one
   quiet word, and its card is the long-opaque-string card the wallet's payout
   address already is. Vouching is signed and priced: it happens on the pad, in
   the pad's own grammar, and nothing on this page can do it by accident. */
export function Screen() {
  return <InvitesBody />;
}
