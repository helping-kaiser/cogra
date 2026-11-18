/* SAVED, YOUR REMOVED POST'S MENU OPEN (round 55, backlog 223). A thing removed
   after it was saved keeps its place in Saved and wears its removal mark
   (Saved.md) — @sol's salt maps, removed by @sol — and its ⋮ raises
   `OWN_REMOVED_POST_MENU` with the post kept: Unsave, Cite in a new post,
   Cited by, Opinions on this, License terms, your own post's menu less Edit,
   Mark as sensitive and Remove. Unstacked over Saved, as
   `SavedCommentMenuOwn`.

   REGISTERED under the `saved` prefix, `saved.menuSheet`. */
export const NODE = "saved";
export function Screen() {
  return (
    <>
      <SavedTop>
        <PostCard id={SOL_POST.id} author={SOL} timestamp="3d" redacted={{ reason: "author", when: "2d" }} score="9.10" comments={2} bundle={mkBundle(0.1, 1)} menuItems={keptMenu(OWN_REMOVED_CARD_MENU)} node="card" />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </SavedTop>
      <CardMenuSheet items={keptMenu(OWN_REMOVED_POST_MENU)} />
    </>
  );
}
