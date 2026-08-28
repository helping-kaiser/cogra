/* Direction 1 · The observatory — the orbit is the tab's hero: a tall card
   under the search field, recents below. Searching drops the hero (it falls
   off the bottom edge) and the same shell becomes the results surface. */
export function Screen() {
  return (
    <>
      <CograBand>
        <SearchBar query="" placeholder="Search people, posts, topics…" />
      </CograBand>
      <Column>
        <div style={{ padding: "0 0 8px 0" }}>
          <Card style={{ flex: "none" }}>
            <div style={{ margin: "0 calc(-1 * var(--card-padding))", marginTop: "calc(-1 * var(--card-padding))" }}>
              <OrbitField height={180} />
            </div>
            <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>The orbit</h2>
            <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
              The graph as a sky — every account a star, sized by your own paths to it.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button size="sm">Enter the orbit</Button>
            </div>
          </Card>
        </div>
        <SectionLabel>Recent</SectionLabel>
        <RecentRow text="@sol salt" />
        <RecentRow text="#saltmaps" />
        <RecentRow text="coast road" />
      </Column>
      <BottomNav active="search" slots={ALL_SLOTS} inline />
    </>
  );
}
