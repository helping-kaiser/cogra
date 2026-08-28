/* Explore, nothing found — the designed empty state (design.md: empty states
   for every list surface, designed, not blank), with the operators offered as
   the way forward. */
export function Screen() {
  return (
    <>
      <div style={{ flex: "none", paddingTop: 12 }}>
        <SearchBar query="brackish cartography" />
        <SearchTriggerRow reading="Everything" />
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 24px" }}>
        <EmptyState title="Nothing carries that name. Search reads names and titles, never bodies — fewer words reach further." />
      </div>
      <BottomNav active="search" slots={ALL_SLOTS} inline />
    </>
  );
}
