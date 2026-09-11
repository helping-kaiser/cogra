/* THE COMMENT'S MENU, OVER THE THREAD (readme §13, the menus round). A comment
   wears the same overflow a post does — the standing ruling that comments and
   posts carry one vocabulary — so the sheet holds the same two rows, pointed at
   the comment instead of the post.

   IT IS DRAWN STACKED ON PURPOSE. The thread already lives in a sheet, so this
   menu is a sheet on a sheet, and that is the state the reader is actually in:
   the menu at the thumb, the thread dimmed behind it and still there. Drawn
   flat it would be indistinguishable from the post's menu, and the one thing
   worth checking here — that a second sheet over the first still reads — would
   go unchecked.

   The menu is `stacked`, so its wash falls between the two layers and its
   surface takes the rung above the thread's. The thread keeps its top edge, its
   handle and its Comments title in view over the menu. */
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet />

      <BottomSheet open stacked ariaLabel="Comment actions">
        <SheetItem label={LICENSE_MENU_LABEL} />
        <SheetItem label="Cite in a new post" />
      </BottomSheet>
    </>
  );
}
