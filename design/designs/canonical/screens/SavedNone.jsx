/* SAVED · nothing matches (jakob 2026-10-14, the Saved redesign: search ships
   with it, "the same search just over a different set of nodes").
   `HistoryNone`'s construction on Saved's page: the field still holding the
   query, and in the list's place one empty state saying what the reader's
   own search found — nothing — with the way back to the whole list.

   IT IS THE READER'S SEARCH, NOT AN EMPTY SAVED. `SavedEmpty` is the reader
   who has kept nothing; this is a list with things in it that a query has
   narrowed to none. So the header and the field stay, and the words name the
   search.

   ONE WAY TO ARRIVE. `HistoryNone` draws two causes, a query and a kind
   narrowed; Saved has no kind filter, so only the query's state exists and
   the board carries no chip. Its first sentence is `HistoryNone`'s with the
   list renamed, and its second is `ExploreNone`'s blessed sentence, reused
   whole, because what the field reads is the one search rule (readme §4,
   *Search*).

   THE WAY BACK IS `Show everything`, the empty state's own action
   (`EmptyState`'s outline button): it clears the query, and Saved stands
   whole again, newest first by when each thing was saved. Typing on is the
   other way on.

   REGISTERED under the `saved` prefix (design ⇄ impl seam 059/061), every
   node named as `Saved` names it — the header, `searchField`, the bar — and
   the empty state `empty`, as `SavedEmpty` names it. */
export const NODE = "saved";
export function Screen() {
  return (
    <>
      <PageHeader title="Saved" backHref="#" backLabel="Back to your profile" node="header" />
      <div style={{ flex: "none" }}>
        <SearchBar query="brackish cartography" ariaLabel="Search what you saved" node="searchField" />
      </div>
      <div style={{ padding: "8px 24px" }}>
        <EmptyState
          title="Nothing you've saved carries that name. Search reads names and titles, never bodies — fewer words reach further."
          actionLabel="Show everything"
          onAction={() => {}}
          node="empty"
        />
      </div>
      <div style={{ flex: 1 }} />
      <BottomNav active="profile" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
