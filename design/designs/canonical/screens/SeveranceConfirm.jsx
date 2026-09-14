/* WALKING IT ALL BACK — the pad's one irreversible gesture, drawn 2026-09-14.
   `SeveranceConfirm` has been a component and a card since the stance work, and
   no canonical board raised it: the only act in this product that takes a
   relationship to nothing existed on the canvas as a specimen and not as a
   moment. This is the moment.

   IT IS A PATTERN, SO IT SITS WITH THE PATTERNS. Severance can be reached from
   any surface carrying a stance — a card in the feed, a post's detail, a
   profile — so drawing it on one of them would make a cross-cutting gate look
   like the feed's own. `PadKeyAbsent` is the precedent and the neighbour: the
   other board where the pad's overlay is the subject and the shell beneath is
   only the ground it stands on. The shell here is the everyday feed for the
   same reason its is — the pad's most ordinary home.

   THE PICK ROUTE IS WHAT IS DRAWN. The dialog serves two routes and is one
   dialog: the explicit `Walk it back` on the pad, and an ordinary pick that
   happens to net the bundle to (0, 0). The second is the one the rule exists
   for — "the control never prevents a choice", so a pick that lands on nothing
   is CONFIRMED and never refused — and it is the one a reader can reach without
   meaning to. The pick line above the consequences is the only thing that tells
   the two apart.

   THE ARITHMETIC IS THE COMPONENT CARD'S, AND IT HAD TO BE. One +1.00 / +1.00
   edge stands and the pick is −1.00 / −1.00, which nets to exactly (0, 0). A
   longer history cannot be drawn on this route at all: a raw sum past the clip
   needs more than one pick's worth of walking back, and the field stops at ±1.
   So the capped aside belongs to the explicit route, and this board states the
   raw total with no cap line under it — the total leads, always, because the
   fold stated first reads as arithmetic that does not work.

   THE COST IS COUNTED IN THINGS. One record stands, so one thing is signed to
   undo it, and the line says so rather than naming an action count.

   THE SAFE ACTION IS THE FILLED ONE. `Keep it` holds the right-hand slot the
   thumb goes to by habit and `Walk it back` stays a text button on the left —
   the destructive-dialog rule, and severance is still one tap away. No `error`
   colour anywhere: walking back is a deliberate choice, not a fault.

   IT NAMES WHAT THE PAD NAMES. `StanceControl` hands the dialog its own
   `targetLabel`, and the pad on a feed card carries the card's — `this post`,
   which is what every board in this tree draws. A dialog saying `@ada` over a
   card whose own face says `this post` would have a reader believe that
   walking back an opinion on a post severs its author. `PadStanding`, beside
   this board, is the pad that raises it, and the two say the same words about
   the same thing.

   THE PAD IS STILL OPEN BEHIND THE WASH. `StanceControl` raises this dialog
   without closing the pad it was picked on, so `Keep it` returns to a pick that
   is still parked. The wash covers it, as the dialog's own scrim covers
   everything beneath — and the pad is drawn once, on its own boards, rather
   than a second time under a dim where nobody could read it. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(1, 1)} />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      <SeveranceConfirm
        pick={{ pDirected: -1, pInterest: -1 }}
        targetLabel="this post"
        bundle={mkBundle(1, 1)}
        records={1}
      />
    </>
  );
}
