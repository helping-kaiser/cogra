/* YOUR OWN PROFILE'S POSTS VIEW, YOUR REMOVED POST'S MENU OPEN (round 55,
   backlog 223). A post of your own removed keeps its place on your own
   profile's Posts tab as its mark (jakob 2026-11-18, profiles (a);
   `ProfilePostsOwn`'s `removed`) — @sol's salt maps — and its ⋮ raises
   `OWN_REMOVED_POST_MENU`: Save, Cite in a new post, Cited by, Opinions on
   this, License terms, as `FeedRemovedMenuOwn`. The page beneath is
   `ProfilePostsMenuOwn`'s, the Posts tab lit.

   REGISTERED under the `profile` prefix, `profile.menuSheet`, told apart by
   board. */
export const NODE = "profile";
export function Screen() {
  return (
    <>
      <ProfileTabTop own tab="posts">
        <PostCard id={SOL_POST.id} author={SOL} timestamp="3d" redacted={{ reason: "author", when: "now" }} score="9.10" comments={2} bundle={mkBundle(0.1, 1)} menuItems={OWN_REMOVED_CARD_MENU} node="card" />
      </ProfileTabTop>
      <CardMenuSheet items={OWN_REMOVED_POST_MENU} />
    </>
  );
}
