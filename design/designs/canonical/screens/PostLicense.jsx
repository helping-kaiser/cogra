/* THE POST'S LICENSE, ASKED FOR (readme §13, the menus round). What the menu's
   License terms row opens: the terms in a sheet over the post they belong to.
   The read is still there beneath the wash — a reuser checking what they owe
   has not left the post to do it, and the way back is the way out of any
   sheet.

   ONE BOARD, TWO MENUS. The reader's ⋮ and the author's own both carry the
   License terms row, and both land here: the terms of a post read the same
   whichever menu asked for them, so this is the master and the own-post menu's
   row points at it.

   THE POST IS ADA'S, whose terms are credit on every use and no record of use
   — two axes that genuinely differ, so the block reads as the pair it is. The
   both-axes-zero case, and the word readers have for it, is drawn on the
   comment's sheet. */
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <LicenseSheet license={ADA_POST.license} />
    </>
  );
}
