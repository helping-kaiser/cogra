/* THE AFFINITY'S PAD, PARKED OVER THE TOPIC IT BELONGS TO (backlog item 78,
   drawn 2026-09-15) — the first board in this tree that draws the Affinity
   family's own words, and the only one that shows the way out of a held topic.

   THE WORDS WERE RECORDED AND DRAWN NOWHERE, WHICH IS THE DEBT THIS PAYS. The
   topic round gave the family six words of its own and the mechanism to carry
   them (`AFFINITY_AXES`, through `StanceControl`'s `axes`), and then no board
   opened the pad they live in: `TagPage` and `TagPageHeld` draw the ROW, whose
   anchor is a face and a pair, and the tap's edge pointed at `VouchBackPad` —
   a first vouch on a PERSON, whose field says `Against / For`. Changing all
   six words moved not one rendered board, which is the exact shape of the
   problem: prose a canvas review cannot look at.

   IT IS THE HELD STATE, BECAUSE THAT IS WHERE THE DOOR IS. `StanceControl`
   draws the walk-away only with something to sever, so the pad over a topic
   nobody holds has three controls and the pad over a held one has four. A
   reader's way out of a topic they have taken a position on exists nowhere
   else on this canvas — not on the row, which is one anchor, and not in Your
   topics, which offers no per-row removal on purpose (a × is the affordance
   of a thing that costs nothing, and this costs a signature). So the board
   draws `Walk it back` standing, and its edge leads to the severance ceremony
   at this topic's own price.

   THE SIX WORDS ARE THE FAMILY'S (jakob's ruling, 2026-09-15). Association
   runs `Dislike` to `Like` and asks `How much you like it`; attraction runs
   `Far away` to `Close to me` and asks `How close you want to be`. The field
   draws the four ends; the two questions reach the sliders, the typed fields
   and every spoken readout, so the accessible route asks what the drawn one
   asks. `TagPad` is the precedent for both halves — a family filling these
   two slots names them in the reader's words, and never in the repo's.

   ONE GESTURE, ONE FACE TABLE. The twenty anchors are the stance's and are
   reused unchanged (jakob, 2026-09-14): an Affinity is not a second kind of
   feeling. What belongs to the family is the words at the edges, which is why
   this board and `PadStanding` are the same anatomy wearing different labels,
   and a reader can hold them side by side and see exactly one difference.

   THE PICK IS POSITIVE, AND DELIBERATELY NOT `PadStanding`'S ARGUMENT. That
   board's pick pulls hard the other way to prove a point about the cap — one
   pick cannot overturn a history, so the walk-away has to be a gesture of its
   own. The point is made and does not want making twice. Here the standing
   `+0.60 / +0.35` takes a modest `+0.25 / +0.30` and lands on `+0.85 / +0.65`,
   and the three readouts come out as three different faces — 😊, 🙂, 🤩 —
   which is the one thing a pad board has to show: three labelled numbers that
   are visibly not each other.

   THE FRAME IS THE PHONE'S, NOT THE TAG PAGE'S OWN 1344. `TagPage` is drawn
   whole because what it records is a LIST, and a list cut off at the fold is a
   list nobody can review. What THIS board records is a parked pad, and parking
   is a fact about the bottom edge of a SCREEN — drawn on a 1344-tall artboard
   the pad would sit half a phone below any thumb that could reach it, which is
   the rule drawn as its own opposite. The surface beneath is the real
   `TagPageBody`, clipped by the frame the way a phone clips it.

   THE WASH IS THE SHELL'S, the parked pad above it sharp — `VouchBackPad`'s
   arrangement, unchanged, because nothing about the record family changes how
   a pad is parked. And no `padInset` rides with it: the inset lifts the parked
   card clear of a bottom bar, and a tag page has none — it is a subpage of
   search, which is the settings round's rule for a surface a reader arrives
   at, reads, and leaves. */

export function Screen() {
  return (
    <>
      <TagPageBody bundle={mkBundle(0.6, 0.35)} stanceOpen stanceDefaultPick={{ pDirected: 0.25, pInterest: 0.3 }} />

      {/* The wash sits over the shell; the parked pad (fixed, above it) stays
          sharp. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim-dialog)" }} />
    </>
  );
}
