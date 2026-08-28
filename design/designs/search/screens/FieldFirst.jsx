/* Direction 2 · Field first — the tab IS the search field: no brand band, the
   pill at the very top, recents under it, and the orbit as a docked band above
   the bar (this whole band is what drops off the screen when typing starts). */
export function Screen() {
  return (
    <>
      <div style={{ flex: "none", paddingTop: 12 }}>
        <SearchBar query="" placeholder="Search people, posts, topics…" />
      </div>
      <Column>
        <SectionLabel>Recent</SectionLabel>
        <RecentRow text="@sol salt" />
        <RecentRow text="#saltmaps" />
        <RecentRow text="coast road" />
        <div style={{ flex: 1 }} />
        <div style={{ flex: "none", background: "var(--surface-container)", borderRadius: "var(--radius-medium) var(--radius-medium) 0 0" }}>
          <OrbitField height={96} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 16px 12px 16px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>The orbit</span>
              <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>The graph as a sky.</span>
            </div>
            <Button size="sm">Enter</Button>
          </div>
        </div>
      </Column>
      <BottomNav active="search" slots={ALL_SLOTS} inline />
    </>
  );
}
