/* YOUR OWN PROFILE'S POSTS VIEW (round 41; jakob 2026-11-11, M2 "as rec",
   backlog 160). The Posts tab of the reader's own profile, a board of its own
   beside `ProfilePosts` (@ada's) rather than a setting on it: a chip copy
   would re-key that board's registered paths. The head is `Profile`'s —
   `ProfileOwnBody`'s band and header, Edit profile and Invites in the actions
   row — with the Posts tab lit; the card is the reader's own post as
   `ProfilePostsMenuOwn` draws it, its ⋮ the own post menu (Save, Cite, Edit,
   Mark as sensitive, Remove, the license closing it; no Hide, no Report).

   REGISTERED under the `profile` prefix, told apart by board as
   `ProfilePostsMenuOwn`. */
export const NODE = "profile";
export function Screen() {
  return (
    <ProfileTabTop own tab="posts">
      <PostCard {...SOL_POST} menuItems={OWN_POST_MENU.filter((row) => row !== LICENSE_ROW)} bundle={mkBundle(0.1, 1)} node="card" />
    </ProfileTabTop>
  );
}
