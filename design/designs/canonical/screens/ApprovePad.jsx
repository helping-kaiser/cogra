/* APPROVING IS VOUCHING — the pad, parked open on an applicant.

   THIS IS THE OTHER SIDE OF `VouchBackPad`. The handshake has two halves and
   the product now draws both: the joiner's first opinion toward their inviter,
   and the inviter's first opinion toward them. Same master, same anatomy, same
   low defaults — because it is the same act, and drawing the inviter's half as
   a button labelled "Approve" would hide a signed, priced stance behind a word
   that sounds like moderation.

   THERE IS NO PREFILL TO LOAD. The link used to carry suggested values for
   exactly this moment; the ruling took them out of the mechanic. What the pad
   opens at is the system's standing default for every normal act, `+0.10 /
   +0.10` — deliberately low, so that stronger stances stay expressible
   (`invitations.md` §3). An uncustomised approval is a real but modest
   endorsement, which is what a first vouch honestly is.

   NO `Walk it back`. That control appears when there is a bundle to undo, and
   a first vouch has none: nothing has been signed toward this person yet, by
   anyone, because their Profile did not exist until this act made it possible.
   `StanceControl` works that out from the absent bundle; nothing here asks for
   it.

   THE ANCHOR IS THE ROW'S OWN CONTROL. A row in this list has two things a
   reader can do to it, and while the pad is open the one in the trailing slot
   is the opinion being given rather than the close it replaces. Under the wash
   it is inert like everything else on the page — which is what the board's
   `scanExempt` line says — and only the parked pad is live.

   THE PAD SITS 16px OFF THE BOTTOM EDGE, not 80. This surface carries no
   bottom bar, and the pad's home is 16px above the bar where there is one and
   16px off the edge where there is not.

   THE NOTE IS NOT COACHING. `VouchBackPad`'s lines teach a gesture once;
   these two state what Set does, every time, because approving is rare and
   because §3's honesty rule wants anything priced to say so before it is
   signed. */
export function Screen() {
  return (
    <>
      <InvitesBody approving />

      {/* The wash sits over the page; the parked pad (fixed, above it) stays sharp. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim-dialog)" }} />
    </>
  );
}
