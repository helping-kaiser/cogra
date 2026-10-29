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

   A MIXED SEARCH KEEPS ITS RESULTS AND GAINS THE LINE (jakob 2026-10-02, the
   fix-fix round's ruling 18). Comments beside another kind with no scope:
   the other kinds' results stand, and the same line stands under them — it
   says honestly what is missing and the way to it.

   THE TRIGGER READS THE FILTER BACK: one kind on, so the pill says that kind's
   name — the filter's own reading rule (`feedFilterSummary`).

   REGISTERED under the `explore` prefix (design ⇄ impl seam 062/063), named
   as `ExploreNone` is: the line stands in the same place, as `empty`.

   THE `kinds` CHIP DRAWS THE MIXED SEARCH THAT FOUND NOTHING ELSE (seam
   248). Comments beside Profiles, a bare query no person answers: no row
   stands, and the region says only the way to the comments — the scope line
   alone, never `ExploreNone`'s line beside it, because the one honest
   reason nothing stands is the one the scope line names. Only the trigger
   moves, reading the two kinds as `2 kinds` (the filter's reading rule). */
export const NODE = "explore";
export const PROPS = { kinds: { editor: "enum", options: ["comments", "mixed"], default: "comments" } };
export const VALS = `commentsShown: this.props.kinds === "mixed" ? "none" : "block", mixedShown: this.props.kinds === "mixed" ? "block" : "none"`;
export function Screen() {
  return (
    <>
      <div style={{ flex: "none", paddingTop: 12 }}>
        <SearchBar query="salt flats" onClear={() => {}} node="searchField" />
        <div style={{ display: "{{commentsShown}}" }} data-node-chip="kinds" data-node-key="comments">
          <SearchTriggerRow reading="Comments" />
        </div>
        <div style={{ display: "{{mixedShown}}" }} data-node-chip="kinds" data-node-key="mixed">
          <SearchTriggerRow reading="2 kinds" />
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 24px" }}>
        <EmptyState title="Found through people and tags — start with @handle or #tag." node="empty" />
      </div>
      <BottomNav active="search" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
