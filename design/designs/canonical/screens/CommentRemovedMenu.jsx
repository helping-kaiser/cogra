/* COMMENTS · YOUR COMMENT, REMOVED, ITS MENU OPEN (jakob 2026-11-13, point C:
   a removed comment's menu follows the post's). Your own removed comment's ⋮
   raises `OWN_REMOVED_COMMENT_MENU` over the thread — Save, Cite in a new
   post, Cited by, Opinions on this, License terms: your own comment's menu
   less Edit and Remove, which have nothing left to act on. The license stays
   because its terms still bind every use already made, as on a removed post.

   The thread beneath is `CommentRemoved`'s, the sheet stacked over it as
   `CommentMenuOwn` stacks its own. REGISTERED under the `postDetail` prefix,
   named as `CommentMenuOwn` is. */
export const NODE = "postDetail";
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet removed scrolledBy={REMOVED_COMMENT_SCROLL} node="threadSheet" />

      <BottomSheet open stacked ariaLabel="Comment actions" node="menuSheet">
        {OWN_REMOVED_COMMENT_MENU.map((item) => (
          <SheetItem key={item.label} label={item.label} node={item.node} />
        ))}
      </BottomSheet>
    </>
  );
}