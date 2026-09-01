/* Someone else's profile — the drill-in an author chip opens (profile round,
   item 23). Back arrow up top, the bar still riding (a read drill-in, Q37) with
   no slot lit — this is Ada's page, not one of the viewer's tabs. The stance on
   the person leads the actions row; everything rarer lives in the one menu (a
   mention is the Reference gesture toward a Profile). The figures row is one tap
   target toward the stances page, both directions separated there. */
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
            menuItems={[{ label: "Mention in a new post", onSelect: () => {} }]}
          />
        </div>
        <div style={{ padding: "4px 16px 12px" }}>
          <SegmentedFilter
            ariaLabel="What the chronicle shows"
            value="everything"
            options={[
              { value: "posts", label: "Posts" },
              { value: "comments", label: "Comments" },
              { value: "everything", label: "Everything" },
            ]}
          />
        </div>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <ChronicleRow label="Published a post" time="2h" snippet="The long way home — the light does something at the third headland." />
          <ChronicleRow label="Commented" time="1d" snippet="The glovebox camera earns its keep — this is the print from 2019." />
          <ChronicleRow label="Took a stance" time="2d" link={false} />
          <ChronicleRow label="Published a post" time="5d" snippet="Took the coast road instead of the tunnel. Four hours longer, worth every minute." />
          <ChronicleRow label="Updated their profile" time="1w" link={false} />
        </div>
      </div>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
