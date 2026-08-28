/* The Explore tab at rest (readme §13, the search rulings; hybrid of the
   ideation's directions 1 + 2): the search field under the brand band, THE SKY
   as the hero card — item 16's future 3D view, never a small side thing — and
   the device-local recents below. Typing drops the hero off the bottom edge
   and the searching view takes the screen. */
export function Screen() {
  return (
    <>
      <CograBand>
        <SearchBar query="" placeholder="Search people, posts, topics…" />
      </CograBand>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0 0 8px 0" }}>
          <Card style={{ flex: "none" }}>
            <div style={{ margin: "0 calc(-1 * var(--card-padding))", marginTop: "calc(-1 * var(--card-padding))" }}>
              <SkyField height={180} />
            </div>
            <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>The Sky</h2>
            <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
              The graph as a sky — every account a star, sized by your own paths to it.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button size="sm">Enter the Sky</Button>
            </div>
          </Card>
        </div>
        <SectionLabel>Recent</SectionLabel>
        <RecentRow text="@sol salt" />
        <RecentRow text="#saltmaps" />
        <RecentRow text="coast road" />
      </div>
      <BottomNav active="search" slots={ALL_SLOTS} inline />
    </>
  );
}
