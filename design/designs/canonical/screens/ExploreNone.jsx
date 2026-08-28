/* Explore, nothing found — the designed empty state (design.md: empty states
   for every list surface, designed, not blank), with the operators offered as
   the way forward. */
export function Screen() {
  return (
    <>
      <div style={{ flex: "none", paddingTop: 12 }}>
        <SearchBar query="brackish cartography" />
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 16px 8px 16px" }}>
          <SearchFilterTrigger reading="All kinds · ranked · showing seen" />
          <HelpDot />
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 24px" }}>
        <EmptyState title="Nothing carries that name. Search matches names and titles — fewer words reach further." />
      </div>
      <BottomNav active="search" slots={ALL_SLOTS} inline />
    </>
  );
}
