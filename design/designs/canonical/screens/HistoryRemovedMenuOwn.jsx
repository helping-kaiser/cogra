/* HISTORY, YOUR REMOVED POST'S MENU OPEN (round 55, backlog 223). Your own
   posts join History as anything else does, and a thing removed after it was
   seen keeps its place there, wearing its mark (History.md) — @sol's salt
   maps, removed by @sol — and its ⋮ raises `OWN_REMOVED_POST_MENU`: Save,
   Cite in a new post, Cited by, Opinions on this, License terms, your own
   post's menu less Edit, Mark as sensitive and Remove, as `FeedRemovedMenuOwn`.
   Unstacked over History, as `HistoryPostMenuOwn`.

   REGISTERED under the `history` prefix, `history.menuSheet`. */
export const NODE = "history";
export function Screen() {
  return (
    <>
      <HistoryTop>
        <PostCard id={SOL_POST.id} author={SOL} timestamp="3d" redacted={{ reason: "author", when: "2d" }} score="9.10" comments={2} bundle={mkBundle(0.1, 1)} menuItems={OWN_REMOVED_CARD_MENU} node="card" />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </HistoryTop>
      <CardMenuSheet items={OWN_REMOVED_POST_MENU} />
    </>
  );
}
