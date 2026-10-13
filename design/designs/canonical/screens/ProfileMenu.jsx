/* ANOTHER PERSON'S PROFILE MENU (readme §13, the menus round). Five rows, and
   none of them the post menu's first two: a profile declares no license, and
   the word for referencing a person is mentioning, not citing. Report closes
   the sheet (jakob 2026-10-09, ruling 75 — `REPORT_ROW`'s note).

   MENTIONING IS CITING. Both stage the same fact — a Reference edge from the
   post being written to the thing it points at — and the two words only record
   what sits at the far end: a person, or anything else. So this row opens the
   same composer the post menu's does, with the reference already staged; only
   its label knows the difference.

   A PERSON IS SAVEABLE (jakob, the private-viewer-state round), so Save leads
   here as it does on a post, and the person joins the one mixed Saved list.

   HIDE SITS LOW. It is the rarest comfort and the only row that takes
   something away, so it sits far from the thumb's first target — and it
   names the handle, `Hide @ada`, which is the word the reader will look for
   again under Hidden accounts in settings. No confirm: the rows go and a
   snackbar offers Undo, because hiding clears your own feed and nothing else.

   Share is a row here and a glyph elsewhere. On a post, share rides the
   affordance row, where the acts are; a profile has no such row — its one wide
   control is the stance on the person — so sharing arrives in the menu instead
   of inventing a second row to hold it.

   REGISTERED under the `profile` prefix (design ⇄ impl seam 059/061): the page
   is `ProfileOther`'s, and the sheet is `menuSheet`, each row named by its own
   `node`. */
export const NODE = "profile";
export function Screen() {
  return (
    <>
      <ProfileOtherBody />

      <BottomSheet open ariaLabel="Profile actions" node="menuSheet">
        {PROFILE_MENU.map((item) => (
          <SheetItem key={item.label} label={item.label} node={item.node} />
        ))}
      </BottomSheet>
    </>
  );
}
