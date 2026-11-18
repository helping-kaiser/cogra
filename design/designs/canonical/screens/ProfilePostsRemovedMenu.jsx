/* THE PROFILE'S POSTS VIEW, A REMOVED POST'S MENU OPEN (round 57, backlog
   223; jakob 2026-11-18, profiles (a)). @ada's post, removed by her, keeps
   its place on her Posts tab as the feed's removed card (`ProfilePosts`'
   `removed`), and its ⋮ raises the reader's post menu whole — Save, Cite in
   a new post, `Hide @ada`, Cited by, Opinions on this, License terms, Report
   at the tail — the same rows on a removed post as on any (`FeedRemovedMenu`,
   `HistoryRemovedMenu`). Unstacked over the profile, the removed card alone
   on the tab, as `ProfileCommentsRemovedMenu`.

   REGISTERED under the `profile` prefix, `profile.menuSheet`, as
   `ProfilePostsMenu` names it. */
export const NODE = "profile";
export function Screen() {
  return (
    <>
      <ProfileTabTop tab="posts">
        <PostCard id="a2b9d4e1-6c3f-4f7a-8e5d-0b1c2d3e4f5a" author={ADA} timestamp="5d" redacted={{ reason: "author", when: "2h" }} score="4.70" comments={1} menuItems={readerCardMenu("ada")} node="card" />
      </ProfileTabTop>
      <CardMenuSheet items={readerPostMenu("ada")} />
    </>
  );
}
