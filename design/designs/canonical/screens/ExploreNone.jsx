/* Explore, nothing found — the designed empty state (design.md: empty states
   for every list surface, designed, not blank), with the operators offered as
   the way forward.

   REGISTERED under the `explore` prefix (design ⇄ impl seam 062/063), named
   as `ExploreSearch` names the field; the line is `empty`. */
export const NODE = "explore";
export function Screen() {
  return (
    <>
      <div style={{ flex: "none", paddingTop: 12 }}>
        <SearchBar query="brackish cartography" node="searchField" />
        <SearchTriggerRow reading="Everything" />
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 24px" }}>
        <EmptyState title="Nothing carries that name. Search reads names and titles, never bodies — fewer words reach further." node="empty" />
      </div>
      <BottomNav active="search" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
