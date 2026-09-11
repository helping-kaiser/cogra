/* The profile's POSTS view (profile round, item 23): the first tab — the
   person's posts as the real cards, not chronicle entries. The header block
   rides above every tab view unchanged; only the list below the tab row
   changes. Drawn on @ada's profile — the master instance every profile's
   posts tab follows. The ⋮ rides the actions row and holds the whole profile
   menu, exactly as the profile's own board draws it (the band law): a tab of a
   page is not a smaller page. */
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
      <PageHeader title="@ada" backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "0 16px" }}>
          <ProfileHeader
            handle="ada"
            displayName="Ada Okonkwo"
            avatarSrc="ava1.jpg"
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
        <TabBar ariaLabel={CHRONICLE_TABS_LABEL} value="posts" tabs={CHRONICLE_TABS} />
        <FeedList>
          <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
          <PostCard {...ADA_SECOND_POST} />
        </FeedList>
      </div>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
