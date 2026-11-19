/* THE TAG'S PAGE, YOUR OWN TAGGED COMMENT'S MENU OPEN (round 60, backlog 284;
   jakob 2026-11-19, C2 "as rec"). The page lists only claims whose author is
   the content's own author (TagPage.md), so your own comment stands on it
   once you tag it — @sol's comment on @mira's gallery post, the card every
   own-comment board draws (`ProfileCommentsMenuOwn`), in the third row — and
   its ⋮ raises the own comment menu: Save, Cite in a new post, Edit, Remove,
   Cited by, Opinions on this, License terms, and no Hide and no Report, own
   menus carrying none. Over `TagPageBody` clipped at the phone's 844,
   unstacked, as `TagPageCommentMenu`.

   REGISTERED under the `tagPage` prefix, `tagPage.menuSheet`, told apart by
   board. */
export const NODE = "tagPage";
export const FRAME = { width: 390, height: 844 };
export function Screen() {
  return (
    <>
      <TagPageBody ownComment="live" scrolledBy={TAG_PAGE_COMMENT_SCROLL} />
      <CardMenuSheet items={OWN_COMMENT_MENU} ariaLabel="Comment actions" />
    </>
  );
}
