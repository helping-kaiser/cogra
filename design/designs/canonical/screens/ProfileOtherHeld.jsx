/* Someone else's profile WITH AN OPINION ALREADY HELD (jakob's review of the
   geek round, 2026-09-11) — the one held state where the reading mode touches
   layout, drawn so neither client guesses it.

   THE ANSWER IS: NOTHING MOVES. The anchor and Message split the row at
   `flex: 1` each, so the pair a geek reader turns on paints INSIDE the
   anchor's own half, beside the face — Message keeps its width in both modes,
   and the row's geometry is mode-invariant like every other board's markup.
   In the default mode the anchor carries the face alone; the exact pair rides
   its `cg-exact` span and the button's accessible name in both modes.

   The board is `ProfileOther` with a bundle — same body helper, one prop —
   because a held opinion is a STATE of that page, not a second page. */
export function Screen() {
  return <ProfileOtherBody bundle={mkBundle(0.7, 0.4)} />;
}
