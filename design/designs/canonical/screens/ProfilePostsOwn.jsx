/* YOUR OWN PROFILE'S POSTS VIEW (round 41; jakob 2026-11-11, M2 "as rec",
   backlog 160). The Posts tab of the reader's own profile, a board of its own
   beside `ProfilePosts` (@ada's) rather than a setting on it: a chip copy
   would re-key that board's registered paths. The head is `Profile`'s —
   `ProfileOwnBody`'s band and header, Edit profile and Invites in the actions
   row — with the Posts tab lit; the card is the reader's own post as
   `ProfilePostsMenuOwn` draws it, its ⋮ the own post menu (Save, Cite, Edit,
   Mark as sensitive, Remove, the license closing it; no Hide, no Report).

   AN EMPTY TAB (the `posts` chip's `none`) reads `Nothing here yet.`, the line
   alone, an applicant's own as a member's (jakob 2026-11-12, the re-ask's
   sixteenth): only `Everything` carries the applicant's sentence. The `load`
   chip draws the first page's wait and failure, `ProfileTabFirstPage`'s, as
   on `ProfilePosts`.

   REGISTERED under the `profile` prefix, told apart by board as
   `ProfilePostsMenuOwn`. */
export const NODE = "profile";
export const PROPS = {
  posts: { editor: "enum", options: ["some", "none"], default: "some" },
  load: { editor: "enum", options: ["loaded", "loading", "failed"], default: "loaded" },
};
export const VALS = `someShown: this.props.load === "loaded" && this.props.posts !== "none" ? "contents" : "none", noneShown: this.props.load === "loaded" && this.props.posts === "none" ? "block" : "none", loadingShown: this.props.load === "loading" ? "block" : "none", failedShown: this.props.load === "failed" ? "block" : "none"`;
export function Screen() {
  return (
    <ProfileTabTop own tab="posts">
      <div style={{ display: "{{someShown}}" }}>
        <PostCard {...SOL_POST} menuItems={OWN_POST_MENU.filter((row) => row !== LICENSE_ROW)} bundle={mkBundle(0.1, 1)} node="card" />
      </div>
      <div style={{ display: "{{noneShown}}", padding: "0 16px" }}>
        <EmptyState title="Nothing here yet." node="empty" />
      </div>
      <ProfileTabFirstPage top={0} />
    </ProfileTabTop>
  );
}
