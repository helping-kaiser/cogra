/* YOUR OWN PROFILE'S POSTS VIEW, YOUR POST'S MENU OPEN (round 36; jakob
   2026-11-11, H7). The own profile's Posts tab is one of the own menu's hosts
   (FeedPostMenuOwn.md): @sol's salt maps on @sol's own page, its ⋮ raising the
   own post menu — Save, Cite, Edit, Mark as sensitive, Remove, Cited by,
   Opinions on this, License terms,
   and no Hide and no Report. The page beneath is the reader's own profile,
   `ProfileOwnBody`'s header, with the Posts tab lit.

   REGISTERED under the `profile` prefix, `profile.menuSheet`, told apart by
   board as `ProfilePostsMenu`. */
export const NODE = "profile";
export function Screen() {
  return (
    <>
      <ProfileTabTop own tab="posts">
        <PostCard {...SOL_POST} menuItems={OWN_POST_MENU.filter((row) => row !== LICENSE_ROW)} bundle={mkBundle(0.1, 1)} node="card" />
      </ProfileTabTop>
      <CardMenuSheet items={OWN_POST_MENU} />
    </>
  );
}
