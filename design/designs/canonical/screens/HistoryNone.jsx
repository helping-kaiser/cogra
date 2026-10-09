/* HISTORY · nothing matches (jakob 2026-10-05, the final brief: "rest sounds
   good" — the no-match state the History redesign left owed). `ExploreNone`'s
   construction on History's page: the field still holding the query, the
   trigger still reading the filter, and in the list's place one empty state
   saying what the reader's own narrowing found — nothing — with the way back
   to the whole list.

   IT IS THE READER'S NARROWING, NOT AN EMPTY HISTORY. `HistoryEmpty` is the
   account that has seen nothing; this is a history with things in it that a
   query or a kind filter has narrowed to none. So the header, the field and
   the trigger stay, and the words name the narrowing.

   TWO WAYS TO ARRIVE, ONE BOARD (the `cause` chip). `search` — a query
   nothing seen carries, the trigger at `Everything` — reads `ExploreNone`'s
   two sentences with the list named: what search reads is the one search
   rule (readme §4, *Search*), so its blessed second sentence is reused
   whole. `kinds` — the field empty, the trigger narrowed to a kind nothing
   seen is — reads that no seen thing is of that kind.

   THE WAY BACK IS `Show everything`, the empty state's own action
   (`EmptyState`'s outline button): it clears the query and the kinds at
   once, and History stands whole again at `Everything`, newest first by first seeing.
   Typing on, or narrowing again from the trigger, are the other ways on.

   Its words are new and blessed (jakob 2026-10-05; copy-voice, *Saved,
   History and hiding*).

   REGISTERED under the `history` prefix (design ⇄ impl seam 062/063), every
   node named as `History` names it — the header, `searchField`,
   `filterTrigger`, the bar — and the empty state `empty`, as `HistoryEmpty`
   names it. The `cause` chip draws the field, the trigger and the empty
   state twice, one shown at a time: each copy keeps the one path and takes
   the chip's value as its key, `search` or `kinds` (jakob 2026-10-06, seam
   069 — a chip-drawn state duplicate; `_build/node-paths.mjs`). */
export const NODE = "history";
export const PROPS = { cause: { editor: "enum", options: ["search", "kinds"], default: "search" } };
export const VALS = `searchShown: this.props.cause === "kinds" ? "none" : "block", kindsShown: this.props.cause === "kinds" ? "block" : "none"`;

export function Screen() {
  return (
    <>
      <PageHeader title="History" backHref="#" backLabel="Back to your profile" node="header" />
      <div style={{ display: "{{searchShown}}" }} data-node-chip="cause" data-node-key="search">
        <div style={{ flex: "none" }}>
          <SearchBar query="brackish cartography" ariaLabel="Search your history" node="searchField" />
          <div style={{ display: "flex", alignItems: "center", padding: "0 16px 8px 16px" }}>
            <FilterTrigger reading="Everything" ariaLabel="What your history shows" node="filterTrigger" />
          </div>
        </div>
        <div style={{ padding: "8px 24px" }}>
          <EmptyState
            title="Nothing you've seen carries that name. Search reads names and titles, never bodies — fewer words reach further."
            actionLabel="Show everything"
            onAction={() => {}}
            node="empty"
          />
        </div>
      </div>
      <div style={{ display: "{{kindsShown}}" }} data-node-chip="cause" data-node-key="kinds">
        <div style={{ flex: "none" }}>
          <SearchBar placeholder="Search your history" ariaLabel="Search your history" node="searchField" />
          <div style={{ display: "flex", alignItems: "center", padding: "0 16px 8px 16px" }}>
            <FilterTrigger reading="Tags" ariaLabel="What your history shows" node="filterTrigger" />
          </div>
        </div>
        <div style={{ padding: "8px 24px" }}>
          <EmptyState title="Nothing you've seen is of that kind." actionLabel="Show everything" onAction={() => {}} node="empty" />
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <BottomNav active="profile" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
