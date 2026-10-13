/* THE TAG'S PAGE, JUST AFTER HIDING SOMEONE FROM A CARD ON IT (jakob
   2026-10-09, item 83 — the aftermath extension; #122's shape). The same
   tap again — a tagged post's ⋮, `Hide @tobias`, the sheet closing — made
   on the one destination a tag has.

   THE PAGE STANDS AS IT STOOD, AND STAYS STANDING. Hiding clears the
   reader's FEED of a person; the hidden list is the feed's (the Saved
   rule, jakob 2026-10-07, ruling 49), and a tag page is a subpage of
   search, not the feed — so the hidden actor's tagged things and their
   claims keep their places here, now and at the next read. Nothing marks
   them: the graph is untouched, and the feed is where the hide shows.

   THE SNACKBAR IS THE FEED'S, WORD FOR WORD, because the act's reach is
   the same whichever surface the tap was made on. The page carries no
   bottom bar, so the line rests at the screen's foot (`Snackbar`'s 16px).

   IT IS `TagPageBody` WITH THE SNACKBAR OVER IT, clipped at the phone's
   844 the way `TagPageHeldPad` clips it — the aftermath is a moment, not
   the whole list.

   REGISTERED under its surface's own prefix, `tagPage` (#122's rule: an
   aftermath's snackbar registers under the surface's prefix). The page's
   own anatomy stays unnamed, as `TagPage` leaves it; the snackbar is
   `snackbar`, its `message` and its `action` — the registration follows
   this drawn state and adds nothing undrawn. */
export const NODE = "tagPage";
export const FRAME = { width: 390, height: 844 };
export function Screen() {
  return (
    <>
      <TagPageBody />
      <Snackbar message="@tobias is hidden — their posts stay out of your feed." action="Undo" offset={16} node="snackbar" />
    </>
  );
}
