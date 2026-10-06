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
   History and hiding*). */
export const PROPS = { cause: { editor: "enum", options: ["search", "kinds"], default: "search" } };
export const VALS = `searchShown: this.props.cause === "kinds" ? "none" : "block", kindsShown: this.props.cause === "kinds" ? "block" : "none"`;

export function Screen() {
  return (
    <>
      <PageHeader title="History" backHref="#" backLabel="Back to your profile" />
      <div style={{ display: "{{searchShown}}" }}>
        <div style={{ flex: "none" }}>
          <SearchBar query="brackish cartography" ariaLabel="Search your history" />
          <div style={{ display: "flex", alignItems: "center", padding: "0 16px 8px 16px" }}>
            <FilterTrigger reading="Everything" ariaLabel="What your history shows" />
          </div>
        </div>
        <div style={{ padding: "8px 24px" }}>
          <EmptyState
            title="Nothing you've seen carries that name. Search reads names and titles, never bodies — fewer words reach further."
            actionLabel="Show everything"
            onAction={() => {}}
          />
        </div>
      </div>
      <div style={{ display: "{{kindsShown}}" }}>
        <div style={{ flex: "none" }}>
          <SearchBar placeholder="Search your history" ariaLabel="Search your history" />
          <div style={{ display: "flex", alignItems: "center", padding: "0 16px 8px 16px" }}>
            <FilterTrigger reading="Tags" ariaLabel="What your history shows" />
          </div>
        </div>
        <div style={{ padding: "8px 24px" }}>
          <EmptyState title="Nothing you've seen is of that kind." actionLabel="Show everything" onAction={() => {}} />
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
