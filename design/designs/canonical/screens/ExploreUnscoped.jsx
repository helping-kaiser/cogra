/* Explore, comments with no scope (readme §13, the indirect kinds are
   scope-served; drawn 2026-10-02). Comments are V1.0's indirect kind: a
   comment result exists only in a query scoped by `@handle` or `#tag`, because
   no body is ever indexed. So a reader who narrows the search to Comments
   alone and types a bare query gets no rows — and the results region says the
   way to them instead.

   ONE QUIET LINE WHERE RESULTS WOULD STAND — the way, not an apology
   (copy-voice, *The search-scope line*). It is the region's empty state,
   `EmptyState`, as `ExploreNone`'s is: the same place, the same register, a
   different reason.

   THE TRIGGER READS THE FILTER BACK: one kind on, so the pill says that kind's
   name — the filter's own reading rule (`feedFilterSummary`). */
export function Screen() {
  return (
    <>
      <div style={{ flex: "none", paddingTop: 12 }}>
        <SearchBar query="salt flats" />
        <SearchTriggerRow reading="Comments" />
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 24px" }}>
        <EmptyState title="Found through people and tags — start with @handle or #tag." />
      </div>
      <BottomNav active="search" slots={ALL_SLOTS} inline />
    </>
  );
}
