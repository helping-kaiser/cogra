/* THE TAG'S PAGE, YOUR REMOVED POST'S MENU OPEN (round 57, backlog 223; jakob
   2026-11-18, tag page (c)). Your own tagged post removed — @sol's salt maps,
   the second row — stands as the feed's removed card while the feed's
   filter has `Removed` on, and its ⋮ raises `OWN_REMOVED_POST_MENU`: Save, Cite in a new
   post, Cited by, Opinions on this, License terms, your own post's menu less
   Edit, Mark as sensitive and Remove, as `FeedRemovedMenuOwn`. Over
   `TagPageBody` clipped at the phone's 844, as `TagPageMenuOwn`.

   REGISTERED under the `tagPage` prefix, `tagPage.menuSheet`, told apart by
   board. */
export const NODE = "tagPage";
export const FRAME = { width: 390, height: 844 };
export function Screen() {
  return (
    <>
      <TagPageBody removed="sol" />
      <CardMenuSheet items={OWN_REMOVED_POST_MENU} />
    </>
  );
}
