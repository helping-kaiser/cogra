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
   sixteenth): only `Everything` carries the applicant's sentence. Its Posts
   figure reads `0`, the list's count (readme §7). The `load`
   chip draws the first page's wait and failure, `ProfileTabFirstPage`'s, as
   on `ProfilePosts`.

   YOUR REMOVED POST KEEPS ITS PLACE (round 57; jakob 2026-11-18, profiles
   (a), no toggle) — the `posts` chip's `removed`: @sol's salt maps as the
   feed's removed card, drawn as `FeedRemoved` and `ProfilePostsRemovedMenuOwn`
   draw it, its ⋮ your own removed post's rows. The card is keyed by its id
   in both copies, as on `ProfilePosts`.

   YOUR POST STILL SETTLING STANDS ON YOUR OWN PROFILE (round 60; jakob
   2026-11-19, C3: "i think it should show on all profiles. the profile should
   not lag behind just because sth is still settling") — the `posts` chip's
   `settling`, `ProfilePosts`' twin: @sol's salt maps signed and not yet
   landed, wearing `Still settling` as the feed's card does (FeedSheet.md),
   its score slot bare and its age `now`, the card keyed by its id in every
   copy, its ⋮ your own post's menu. A STILL-SETTLING THING STANDS AT THE
   HEAD (round 62; jakob 2026-11-23, B1 "in signing order"): `settling-two`
   draws two, the newer signed first (`now`, then `3m`).

   A STILL-SETTLING POST REMOVED BEFORE IT LANDS WEARS BOTH MARKS (round 64;
   jakob 2026-11-23, B4 = (a); backlog 302) — the `posts` chip's
   `settling-removed`: @sol's salt maps signed `now` and removed `now`, the
   removal's mark in the content's place as on `removed`, `Still settling`
   where every settling card wears it (`PostCard`'s `pending`, over the
   action row), its score slot bare; the removal rules its ⋮ (your own removed
   post's rows). Keyed by its id, as every copy.

   REGISTERED under the `profile` prefix, told apart by board as
   `ProfilePostsMenuOwn`. */
export const NODE = "profile";
export const PROPS = {
  posts: { editor: "enum", options: ["some", "none", "settling", "settling-two", "removed", "settling-removed"], default: "some" },
  load: { editor: "enum", options: ["loaded", "loading", "failed"], default: "loaded" },
};
/* The second post still settling (`settling-two`): an existing post drawn as
   the reader's own, as `ReelMenu` draws @mira's clip as @sol's. */
const SOL_SECOND_POST = { ...MIRA_WORDS_POST, author: SOL };
export const VALS = `someShown: this.props.load === "loaded" && this.props.posts !== "none" ? "contents" : "none", noneShown: this.props.load === "loaded" && this.props.posts === "none" ? "block" : "none", liveShown: this.props.posts === "removed" || this.props.posts === "settling" || this.props.posts === "settling-two" || this.props.posts === "settling-removed" ? "none" : "contents", settlingRemovedShown: this.props.posts === "settling-removed" ? "contents" : "none", settlingShown: this.props.posts === "settling" || this.props.posts === "settling-two" ? "contents" : "none", secondSettlingShown: this.props.posts === "settling-two" ? "contents" : "none", removedShown: this.props.posts === "removed" ? "contents" : "none", loadingShown: this.props.load === "loading" ? "block" : "none", failedShown: this.props.load === "failed" ? "block" : "none", postsFigure: this.props.posts === "none" ? "0" : "5"`;
export function Screen() {
  return (
    <ProfileTabTop own tab="posts" posts="{{postsFigure}}">
      <div style={{ display: "{{someShown}}" }}>
        <div style={{ display: "{{liveShown}}" }} data-node-chip="posts" data-node-key="some">
          <PostCard {...SOL_POST} menuItems={OWN_POST_MENU.filter((row) => row !== LICENSE_ROW)} bundle={mkBundle(0.1, 1)} node="card" />
        </div>
        <div style={{ display: "{{settlingShown}}" }} data-node-chip="posts" data-node-key="settling">
          <PostCard {...SOL_POST} timestamp="now" pending score={null} menuItems={OWN_POST_MENU.filter((row) => row !== LICENSE_ROW)} bundle={mkBundle(0.1, 1)} node="card" />
        </div>
        <div style={{ display: "{{secondSettlingShown}}" }} data-node-chip="posts" data-node-key="settling-two">
          <PostCard {...SOL_SECOND_POST} timestamp="3m" pending score={null} menuItems={OWN_POST_MENU.filter((row) => row !== LICENSE_ROW)} node="card" />
        </div>
        <div style={{ display: "{{removedShown}}" }} data-node-chip="posts" data-node-key="removed">
          <PostCard id={SOL_POST.id} author={SOL} timestamp="3d" redacted={{ reason: "author", when: "now" }} score="9.10" comments={2} bundle={mkBundle(0.1, 1)} menuItems={OWN_REMOVED_CARD_MENU} node="card" />
        </div>
        <div style={{ display: "{{settlingRemovedShown}}" }} data-node-chip="posts" data-node-key="settling-removed">
          <PostCard id={SOL_POST.id} author={SOL} timestamp="now" pending redacted={{ reason: "author", when: "now" }} score={null} comments={SOL_POST.comments} bundle={mkBundle(0.1, 1)} menuItems={OWN_REMOVED_CARD_MENU} node="card" />
        </div>
      </div>
      <div style={{ display: "{{noneShown}}", padding: "0 16px" }}>
        <EmptyState title="Nothing here yet." node="empty" />
      </div>
      <ProfileTabFirstPage top={0} />
    </ProfileTabTop>
  );
}
