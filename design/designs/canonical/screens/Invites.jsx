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
   the pad's own grammar, and nothing on this page can do it by accident.

   THE `kept` CHIP DRAWS A KEPT APPROVAL (jakob 2026-10-05, the final brief):
   `waiting` puts the vouch the reader set on @noor's ask link, kept while the
   key was elsewhere, at the head of Applications as its own row reading
   `Waiting for your key` (`KeptApprovalRow`). Once the key is back it reads
   `Ready for your approval`, and it is the row the kept picks' line `An
   approval waits in your invites — go there to sign it.` sends the reader
   to.

   THE `revoke` CHIP DRAWS A REVOKE IN FLIGHT (the check round's Q10, jakob
   2026-10-06): `waiting` is the first link's card past 200ms after its
   Revoke — the card holds and the word reads `Revoking…`, inert and never
   dimmed, because a revoke is a consequential write and waits like one. When
   it lands the card leaves with `Invite revoked`; a failure keeps the card
   with the standard failure answer.

   REGISTERED under the `invites` prefix (design ⇄ impl seam 078, the invites
   packet): the body names its parts, and `NODE` carries them onto the built
   board and into `nodes.json`. The `revoke` chip's two copies of the first
   link's card are one `invites.link` under the link's own id (ruling 39). */
export const NODE = "invites";
export const PROPS = {
  kept: { editor: "enum", options: ["none", "waiting"], default: "none" },
  revoke: { editor: "enum", options: ["rest", "waiting"], default: "rest" },
};
export const VALS = `keptShown: this.props.kept === "waiting" ? "block" : "none", revokeRestShown: this.props.revoke === "waiting" ? "none" : "block", revokeBusyShown: this.props.revoke === "waiting" ? "block" : "none"`;

export function Screen() {
  return <InvitesBody kept="{{keptShown}}" revoke={{ rest: "{{revokeRestShown}}", busy: "{{revokeBusyShown}}" }} />;
}
