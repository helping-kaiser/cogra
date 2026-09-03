/* THE COMMENT'S MENU, OVER THE THREAD (readme §13, the menus round). A comment
   wears the same overflow a post does — the standing ruling that comments and
   posts carry one vocabulary — so the sheet holds the same two rows, pointed at
   the comment instead of the post.

   IT IS DRAWN STACKED ON PURPOSE. The thread already lives in a sheet, so this
   menu is a sheet on a sheet, and that is the state the reader is actually in:
   the comments still legible above the wash, the menu at the thumb. Drawn flat
   it would be indistinguishable from the post's menu, and the one thing worth
   checking here — that a second sheet over the first still reads — would go
   unchecked. */
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet />

      <BottomSheet open ariaLabel="Comment actions">
        <SheetItem label={LICENSE_MENU_LABEL} />
        <SheetItem label="Cite in a new post" />
      </BottomSheet>
    </>
  );
}
