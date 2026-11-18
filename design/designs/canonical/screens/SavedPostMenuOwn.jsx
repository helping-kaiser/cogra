/* SAVED, YOUR OWN POST'S MENU OPEN (round 55, backlog 223). Your own post kept
   in Saved — @sol's salt maps — and its ⋮ raises the own post menu
   (`FeedPostMenuOwn.md`: the own menu on Saved is the detail's own menu),
   `Unsave` first, the post being kept (Saved.md), then Cite, Edit, Mark as
   sensitive, Remove, Cited by, Opinions on this and the license, no Hide and
   no Report. Unstacked over Saved, as `SavedCommentMenuOwn`; no row is added,
   removed or reordered.

   REGISTERED under the `saved` prefix, `saved.menuSheet`. */
export const NODE = "saved";
export function Screen() {
  return (
    <>
      <SavedTop>
        <PostCard {...SOL_POST} menuItems={keptMenu(OWN_POST_MENU).filter((row) => row !== LICENSE_ROW)} bundle={mkBundle(0.1, 1)} node="card" />
      </SavedTop>
      <CardMenuSheet items={keptMenu(OWN_POST_MENU)} />
    </>
  );
}
