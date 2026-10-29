/* The profile's POSTS view (profile round, item 23): the first tab — the
   person's posts as the real cards, not chronicle entries. The header block
   rides above every tab view unchanged; only the list below the tab row
   changes. Drawn on @ada's profile — the master instance every profile's
   posts tab follows. The ⋮ rides the actions row and holds the whole profile
   menu, exactly as the profile's own board draws it (the band law): a tab of a
   page is not a smaller page.

   A PROFILE WITH NO POSTS (the `posts` chip at `none`): the list reads
   `Nothing here yet.`, the line alone — `ProfileComments`' empty tab, the
   member's empty-chronicle line (seam 245, ask 11).

   REGISTERED under the `profile` prefix (round 27, seam 252; the web's minted
   ids, kept). The posts view is a tab of the profile page, not a page of its
   own — its header, identity and tab row are the profile's, as
   `ProfileOtherBody` names them — so it takes the page's prefix, where the
   opinions page, a page with its own header and way back, took its own
   (`profileStances`, round 26). The list is `posts`, each `card` in it keyed by
   the post's id (`PATH_KEY_RULES`: one author's cards share a handle), and
   `empty` in the cards' place. */
export const NODE = "profile";
export const PROPS = { posts: { editor: "enum", options: ["some", "none"], default: "some" } };
export const VALS = `someShown: this.props.posts === "none" ? "none" : "flex", noneShown: this.props.posts === "none" ? "block" : "none"`;
const ADA_POST_ID = "7c1e4b2a-3f5d-4a8e-9b6c-1d2e3f4a5b6c";
const ADA_SECOND_POST_ID = "a2b9d4e1-6c3f-4f7a-8e5d-0b1c2d3e4f5a";
const ADA_SECOND_POST = {
  author: ADA,
  content: "Tunnel closed again this morning. The coast road does not mind.",
  timestamp: "5d",
  score: "4.70",
  comments: 1,
  license: { attribution: 0, provenance: 0 },
  menuItems: CARD_MENU,
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
            posts={12}
            stancesOn={48}
            stancesTaken={31}
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
            <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" nodeKey={ADA_POST_ID} />
            <PostCard {...ADA_SECOND_POST} node="card" nodeKey={ADA_SECOND_POST_ID} />
          </div>
          <div style={{ display: "{{noneShown}}", padding: "8px 16px 0" }}>
            <EmptyState title="Nothing here yet." node="empty" />
          </div>
        </div>
      </div>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
