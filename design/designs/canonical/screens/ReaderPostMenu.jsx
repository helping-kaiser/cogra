/* SOMEONE ELSE'S POST, ITS MENU OPEN (readme §13, the menus round). The one
   overflow every reader's card and detail view has carried since the canvas was
   wired, drawn at last — the sheet the ⋮ opens on fifteen surfaces, mastered
   once here rather than redrawn beside each of them.

   TWO ROWS, BECAUSE TWO THINGS EXIST. The license terms, which every genesis
   record declares and a reuser has to be able to check; and citing, which is
   the reader's way of making this post the subject of their own. Report, hide
   and bookmark are not here: each belongs to a slice the product has not built,
   and a menu row for a function nothing answers is a promise the sheet cannot
   keep.

   The license row does not leave this surface. It closes the sheet and unfolds
   the terms on the card beneath, and the row it leaves behind reads Hide
   license — a reveal in place, never a view of its own. */
export function Screen() {
  return (
    <>
      <DetailHeader items={READER_POST_MENU} />
      <DetailColumn>
        <PostCard {...ADA_POST} variant="detail" />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      <BottomSheet open ariaLabel="Post actions">
        <SheetItem label={LICENSE_MENU_LABEL} />
        <SheetItem label="Cite in a new post" />
      </BottomSheet>
    </>
  );
}
