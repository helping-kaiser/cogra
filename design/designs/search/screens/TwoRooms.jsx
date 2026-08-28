/* Direction 3 · Two rooms — the tab splits into two equal doors: searching and
   the orbit, neither subordinate. The search tile holds the field and the
   freshest recents; the orbit tile is all sky. */
export function Screen() {
  return (
    <>
      <CograBand />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8, padding: "8px 0 8px 0" }}>
        <Card style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>Search</h2>
          <div style={{ margin: "0 -16px" }}>
            <SearchBar query="" placeholder="People, posts, topics…" />
          </div>
          <div style={{ margin: "0 -8px" }}>
            <RecentRow text="@sol salt" />
            <RecentRow text="#saltmaps" />
          </div>
        </Card>
        <Card style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>The orbit</h2>
          <div style={{ margin: "0 calc(-1 * var(--card-padding))", flex: 1 }}>
            <OrbitField height={200} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button size="sm">Enter the orbit</Button>
          </div>
        </Card>
      </div>
      <BottomNav active="search" slots={ALL_SLOTS} inline />
    </>
  );
}
