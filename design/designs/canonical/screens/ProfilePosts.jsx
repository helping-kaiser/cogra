/* The profile's POSTS view (profile round, item 23): the first tab — the
   person's posts as the real cards, not chronicle entries. The header block
   rides above every tab view unchanged; only the list below the tab row
   changes. Drawn on @ada's profile — the master instance every profile's
   posts tab follows. The ⋮ rides the actions row and holds the whole profile
   menu, exactly as the profile's own board draws it (the band law): a tab of a
   page is not a smaller page.

   A PROFILE WITH NO POSTS (the `posts` chip at `none`): the list reads
   `Nothing here yet.`, the line alone — `ProfileComments`' empty tab, the
   member's empty-chronicle line (seam 245, ask 11). The Posts figure reads
   `0` over it: the figure counts what the list holds (readme §7).

   REGISTERED under the `profile` prefix (round 27, seam 252; the web's minted
   ids, kept). The posts view is a tab of the profile page, not a page of its
   own — its header, identity and tab row are the profile's, as
   `ProfileOtherBody` names them — so it takes the page's prefix, where the
   opinions page, a page with its own header and way back, took its own
   (`profileStances`, round 26). The list is `posts`, each `card` in it keyed by
   the post's id as every post card is, and `empty` in the cards' place.

   A POST STILL SETTLING IN THE LIST (round 35, jakob 2026-11-11, T7) is the
   `posts` chip's `settling`: the second post, signed and not yet landed,
   wearing `Still settling` as the feed's card does (FeedSheet.md), its score
   slot bare; the card keyed by its id in both copies, as `ProfileComments`'
   `removed` is. A STILL-SETTLING THING STANDS AT THE HEAD (round 62; jakob
   2026-11-23, B1 "in signing order"): the settling post leads the list, above
   every landed one; `settling-two` draws two, the newer signed first (`now`,
   then `3m`), each taking its place in the order when it lands.

   A REMOVED POST KEEPS ITS PLACE (round 57; jakob 2026-11-18, profiles (a):
   "removed posts should not vanish from profiles … (both others and mine)",
   no toggle) — the `posts` chip's `removed`: the second post, removed by its
   author, as the feed's removed card ("yes same removed cards in profile";
   `FeedRemoved`): `Removed by its author` and the removal's own moment
   (`2h`, never the post's `5d`), the author chip, the opinion, the score,
   the comments count, the share and the ⋮, the reader's post menu whole
   (`ProfilePostsRemovedMenu` draws it open). The tab draws it as
   `ProfileComments` draws its removed comment, the card keyed by its id in
   every copy.

   THE FIRST PAGE'S OTHER MOMENTS (round 45; jakob 2026-11-12, the re-ask's
   fourteenth and fifteenth) are the `load` chip, `ProfileTabFirstPage`'s:
   `loading` the chronicle's `Loading…` in the list's place, `failed`
   `ProfileMoreFailed`'s quiet row with `Retry` where the list would stand.
   Its `more` is the next page that did not come (round 68),
   `ProfileTabNextPage`'s row: the board draws the list's foot, the head and
   the tab row standing — the first post hidden, the second standing over
   the row, as `Notifications`' `more` hides its earlier rows. */
export const NODE = "profile";
export const PROPS = {
  posts: { editor: "enum", options: ["some", "none", "settling", "settling-two", "removed"], default: "some" },
  load: { editor: "enum", options: ["loaded", "loading", "failed", "more"], default: "loaded" },
};
export const VALS = `someShown: (this.props.load === "loaded" || this.props.load === "more") && this.props.posts !== "none" ? "flex" : "none", noneShown: this.props.load === "loaded" && this.props.posts === "none" ? "block" : "none", secondLanded: this.props.posts === "settling" || this.props.posts === "settling-two" || this.props.posts === "removed" ? "none" : "contents", secondSettling: this.props.posts === "settling" || this.props.posts === "settling-two" ? "contents" : "none", firstLanded: this.props.posts === "settling-two" || this.props.load === "more" ? "none" : "contents", firstSettling: this.props.posts === "settling-two" && this.props.load !== "more" ? "contents" : "none", secondRemoved: this.props.posts === "removed" ? "contents" : "none", loadingShown: this.props.load === "loading" ? "block" : "none", failedShown: this.props.load === "failed" ? "block" : "none", moreShown: this.props.load === "more" ? "block" : "none", postsFigure: this.props.posts === "none" ? "0" : "12"`;
const ADA_SECOND_POST = {
  id: "a2b9d4e1-6c3f-4f7a-8e5d-0b1c2d3e4f5a",
  author: ADA,
  content: "Tunnel closed again this morning. The coast road does not mind.",
  timestamp: "5d",
  score: "4.70",
  comments: 1,
  license: { attribution: 0, provenance: 0 },
  menuItems: readerCardMenu("ada"),
};

export function Screen() {
  return (
    <>
      <PageHeader title="@ada" backHref="#" backLabel="Back to feed" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "0 16px" }}>
          <ProfileHeader
            node="identity"
            handle="ada"
            displayName="Ada Okonkwo"
            avatarSrc="comment-camera.jpg"
            bio="A dozen tries at the third headland light and counting."
            posts="{{postsFigure}}"
            stancesOn={6}
            stancesTaken={6}
            onCounts={() => {}}
            onCommit={() => {}}
            onMessage={() => {}}
            menu={otherProfileMenu()}
            showHandle={false}
          />
        </div>
        <TabBar ariaLabel={CHRONICLE_TABS_LABEL} value="posts" tabs={CHRONICLE_TABS} node="tabRow" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }} data-node="posts">
          <div style={{ flex: 1, overflow: "hidden", display: "{{someShown}}", flexDirection: "column", gap: 8, padding: "8px 0 0 0" }}>
            {/* The second post still settling, at the head of the list: the
                feed's settling row (FeedSheet.md), `Still settling` worn under
                the words and the score slot bare, the glyph with no figure
                (ruling 90). Its age reads `now`, the newest signed. */}
            <div style={{ display: "{{secondSettling}}" }} data-node-chip="posts" data-node-key="settling">
              <PostCard {...ADA_SECOND_POST} timestamp="now" pending score={null} node="card" />
            </div>
            <div style={{ display: "{{firstLanded}}" }} data-node-chip="posts" data-node-key="some">
              <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
            </div>
            {/* Two posts still settling (`settling-two`): the first post too,
                signed before the second, so it stands under it, its age `3m`. */}
            <div style={{ display: "{{firstSettling}}" }} data-node-chip="posts" data-node-key="settling-two">
              <PostCard {...ADA_POST} timestamp="3m" pending score={null} node="card" />
            </div>
            <div style={{ display: "{{secondLanded}}" }} data-node-chip="posts" data-node-key="some">
              <PostCard {...ADA_SECOND_POST} node="card" />
            </div>
            {/* The same post removed by its author: the feed's removed card as
                it is (`FeedRemoved`), the mark and its date in the words' and
                pictures' place, the author, the opinion, the score, the
                comments and the share kept, the ⋮ the reader's whole. */}
            <div style={{ display: "{{secondRemoved}}" }} data-node-chip="posts" data-node-key="removed">
              <PostCard id={ADA_SECOND_POST.id} author={ADA} timestamp={ADA_SECOND_POST.timestamp} redacted={{ reason: "author", when: "2h" }} score={ADA_SECOND_POST.score} comments={ADA_SECOND_POST.comments} menuItems={ADA_SECOND_POST.menuItems} node="card" />
            </div>
            <ProfileTabNextPage />
          </div>
          <div style={{ display: "{{noneShown}}", padding: "8px 16px 0" }}>
            <EmptyState title="Nothing here yet." node="empty" />
          </div>
          <ProfileTabFirstPage />
        </div>
      </div>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
