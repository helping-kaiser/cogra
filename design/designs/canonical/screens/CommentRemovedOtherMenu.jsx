/* COMMENTS · ANOTHER'S REMOVED COMMENT, ITS MENU OPEN (round 57, backlog 223;
   jakob 2026-11-18, C2 (a); 2026-11-13, point C: a removed comment's menu
   follows the post's). @tobias's removed comment's ⋮ raises the reader's
   comment menu whole — Save, Cite in a new post, `Hide @tobias` (hide
   targets the person, who outlives the removal), Cited by, Opinions on this,
   License terms, Report at the tail (`CommentRemoved.md`: another's the
   reader's comment menu whole). The thread beneath is `CommentRemovedOther`'s,
   the sheet stacked over it as `CommentMenu`'s.

   REGISTERED under the `postDetail` prefix, named as `CommentMenu` is. */
export const NODE = "postDetail";
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet removedOther node="threadSheet" />

      <BottomSheet open stacked ariaLabel="Comment actions" node="menuSheet">
        {readerCommentMenu("tobias").map((item) => (
          <SheetItem key={item.label} label={item.label} node={item.node} />
        ))}
      </BottomSheet>
    </>
  );
}
