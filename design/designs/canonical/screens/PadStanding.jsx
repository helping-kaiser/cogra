/* THE PAD WITH AN OPINION ALREADY STANDING (backlog item 77, drawn
   2026-09-14) — and therefore the first board in this tree that draws
   `Walk it back`.

   THE MASTER PAD IS A FIRST VOUCH, WHICH IS WHY THIS WAS MISSING.
   `VouchBackPad` is the board every stance face routes to, and its fixture is
   a reader's very first opinion: no records, nothing to walk back, so
   `StanceControl` correctly draws no walk-away — sever needs something to
   sever. Every state past the first was therefore represented by a board that
   could not reach it, and the one irreversible gesture in the stance flow had
   its confirm drawn and its trigger nowhere.

   THIS IS THE ORDINARY CASE, and that is the point. A reader with a history
   taps the same face from the same place; what they have already said is what
   decides which state the pad is in. So the pad here carries FOUR controls
   where the first vouch carries three — `Walk it back` on the left, pushed
   away from Cancel and Set by its own margin, because a walk-away beside a
   commit is a misfire waiting to happen.

   THE FIXTURE IS `SeveranceConfirm`'S, deliberately: @ada, one standing edge
   at +1.00 / +1.00, one record. The two boards sit side by side on this page
   and the arithmetic runs straight through them — what this pad says is
   standing is exactly what that dialog offers to walk back, and a reader
   reading the pair never has to hold two sets of numbers.

   IT IS THE PATTERNS PAGE'S KIND OF BOARD. The pad blooms over whatever
   surface the reader was on — nineteen boards route a stance face here — so
   drawing it on one of them would make a cross-cutting overlay look like that
   surface's own. `PadKeyAbsent` settled this for the pad's other state and
   `SeveranceConfirm` for its confirm; the shell beneath is the everyday feed
   because that is the pad's most ordinary home, not because the state belongs
   to the feed.

   THE WASH IS THE SHELL'S, the parked pad above it sharp — `VouchBackPad`'s
   arrangement, unchanged, because nothing about having a history changes how
   the pad is parked.

   THE PICK IS GIVEN, NOT LEFT AT THE ORIGIN. The twenty-anchor table holds no
   entry at dead centre — the 🤷 belongs to a zero BUNDLE, which is a different
   fact — so a knob resting there reads as its nearest neighbour, and this board
   is not the place to answer a question nobody has asked.

   AND THE PICK PULLS BACK, WHICH IS THE BOARD ARGUING ITS OWN POINT. −0.55 /
   −0.15 against a standing +1.00 / +1.00 lands on +0.45 / +0.85: a firm pull in
   the other direction, and the opinion is still most of the way up. ONE PICK
   DOES NOT OVERTURN A HISTORY — the field stops at ±1, so a reader who wants to
   be done cannot get there by dragging, however hard they drag. That is exactly
   why the walk-away is a gesture of its own rather than a corner of the field,
   and the board says it in three readouts instead of a sentence. A positive
   pick would have said nothing at all: at +1.00 the fold is already at the cap,
   so the landing would have read back unchanged and the pad would look inert. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(1, 1)} stanceOpen stancePadInset={80} stanceDefaultPick={{ pDirected: -0.55, pInterest: -0.15 }} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      {/* The wash sits over the shell; the parked pad (fixed, above it) stays
          sharp. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim-dialog)" }} />
    </>
  );
}
