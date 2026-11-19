/* THE TAG'S PAGE, YOUR REMOVED TAGGED COMMENT'S MENU OPEN (round 60, backlog
   284; jakob 2026-11-19, C2 "as rec"). Your own tagged comment removed —
   @sol's, `TagPageCommentMenuOwn`'s card, as its mark — stands in its row
   while the feed's filter has `Removed` on, and its ⋮ raises
   `OWN_REMOVED_COMMENT_MENU`: Save, Cite in a new post, Cited by, Opinions on
   this, License terms, your own comment's menu less Edit and Remove
   (CommentRemoved.md), as `ProfileCommentsRemovedMenuOwn`. Over `TagPageBody`
   clipped at the phone's 844, unstacked, as `TagPageCommentMenu`.

   REGISTERED under the `tagPage` prefix, `tagPage.menuSheet`, told apart by
   board. */
export const NODE = "tagPage";
export const FRAME = { width: 390, height: 844 };
export function Screen() {
  return (
    <>
      <TagPageBody ownComment="removed" />
      <CardMenuSheet items={OWN_REMOVED_COMMENT_MENU} ariaLabel="Comment actions" />
    </>
  );
}
