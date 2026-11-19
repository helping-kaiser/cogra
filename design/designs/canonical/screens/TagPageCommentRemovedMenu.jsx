/* THE TAG'S PAGE, A REMOVED TAGGED COMMENT'S MENU OPEN (round 60, backlog
   284; jakob 2026-11-19, C2 "as rec"). With the feed's filter's `Removed` on,
   @ada's tagged comment, removed by her, stands in its row as `CommentCard`'s
   own mark (`TagPage`'s `comment` chip's `removed`), and its ⋮ raises the
   reader's comment menu whole — Save, Cite in a new post, `Hide @ada` (hide
   targets the person, who outlives the removal), Cited by, Opinions on this,
   License terms, Report at the tail — "removed or not" (copy-voice, *Menu
   rows*), as `ProfileCommentsRemovedMenu`. Over `TagPageBody` clipped at the
   phone's 844, unstacked, as `TagPageCommentMenu`.

   REGISTERED under the `tagPage` prefix, `tagPage.menuSheet`, told apart by
   board. */
export const NODE = "tagPage";
export const FRAME = { width: 390, height: 844 };
export function Screen() {
  return (
    <>
      <TagPageBody commentRemoved="ada" />
      <CardMenuSheet items={readerCommentMenu("ada")} ariaLabel="Comment actions" />
    </>
  );
}
