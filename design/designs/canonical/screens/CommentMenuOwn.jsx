/* YOUR OWN COMMENT'S MENU, OVER THE THREAD (the comment-removal round,
   2026-10-01; jakob: removing your own comment is V1.0). `CommentMenu`'s board
   with one row more, so it is drawn the way that board is — stacked, a sheet on
   the thread's sheet — and differs from it in the list it is handed and in
   where the thread stands beneath it: scrolled to the reader's own comment,
   @sol's, at the offset the whole removal keeps (`REMOVED_COMMENT_SCROLL`).

   `Remove` STANDS AS THE LAST OF THE ACTS (`OWN_COMMENT_MENU`): Save and Cite
   lead, as on every menu that has them, then Remove, then the two readings, and
   the license closes it. That is the post's own menu's place for the row
   (`RemoveMenu`), at comment scale.

   REGISTERED under the `postDetail` prefix (design ⇄ impl seam 086), named as
   `CommentMenu` is. */
export const NODE = "postDetail";
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet scrolledBy={REMOVED_COMMENT_SCROLL} />

      <BottomSheet open stacked ariaLabel="Comment actions" node="menuSheet">
        {OWN_COMMENT_MENU.map((item) => (
          <SheetItem key={item.label} label={item.label} node={item.node} />
        ))}
      </BottomSheet>
    </>
  );
}
