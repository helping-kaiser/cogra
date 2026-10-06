/* The search filter sheet — what the worded trigger opens: the kinds that
   combine, and the one Order section shared with the feed's filter (item 19:
   `OrderSection`, ruled identical on both). The kind list is `FEED_KINDS` —
   one list, "Profiles" everywhere; here nothing is narrowed, so no chip is
   selected and the search reads everything.

   FOUR KINDS, THE FEED'S FOUR (readme §13, the V1.0 scope cut, 2026-09-25):
   Posts, Comments, Profiles, Tags. The list is one, so the two filters trim
   together. The results beneath the sheet are `ExploreSearch`'s first two
   rows, the post and the tag — search returns no item, offer or message rows
   in V1.0.

   IT STAGES, AND `Done` COMMITS (the sheet law, readme §4, *Sheets*). The
   results beneath are visual only and do not move until Done, when the search
   re-queries once; the scrim, a swipe down, system Back and Escape discard.
   The foot is the feed filter's own `FilterFoot` — `Reset` in the corner,
   `Done` at the end; every filter sheet's foot is the same row. The sheet is
   short enough that its content sizes it, so the foot ends the content rather
   than being pinned under a scroll.

   `Reset` STAGES THE SEARCH'S DEFAULT: no kind narrowed, and the shared axes
   — the order and the seen toggle — at the reader's default, what the
   trigger reads as `Everything`. ONE DEFAULT OBJECT EVERYWHERE (jakob
   2026-10-02, the fix-fix round's ruling 12): the default the reader sets in
   Settings reaches search's order and seen toggle, the axes the two sheets
   share; the kinds stay search's own, since search's kind semantics are
   not the feed's. This reader never set one, so the sheet is drawn at the
   app's.

   THE TRIGGER SPEAKS DEVIATIONS FROM THAT DEFAULT (ruling 10), a deviation
   back toward the app's included, and the "?" — the feed's own dialog —
   says what `Reset` does: `Reset brings back your defaults, to change them
   go to settings.` (ruling 11).

   REGISTERED under the `explore` prefix (design ⇄ impl seam 062/063): the
   results named as `ExploreSearch` names them, and the sheet named as
   `HistoryFilter` names its own — `filterSheet`, its `help`, `title`, the
   `kinds` with each chip as `<value>Chip`, then the `order` and the `foot`. */
export const NODE = "explore";
export function Screen() {
  return (
    <>
      <div style={{ flex: "none", paddingTop: 12 }}>
        <SearchBar query="@sol salt" node="searchField" />
        <SearchTriggerRow reading="Everything" />
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ReferenceRow kind="post" name="Salt maps of the coast road" src="post-photo.jpg" rank="9.10" onOpen={() => {}} node="result" nodeKey="1" />
        <ReferenceRow kind="topic" name="saltmaps" sub="tagged by @sol" rank="3.40" onOpen={() => {}} node="result" nodeKey="2" />
      </div>
      <BottomNav active="search" slots={ALL_SLOTS} inline node="bottomBar" />

      <BottomSheet open ariaLabel="What the search shows" node="filterSheet">
        <div style={{ position: "absolute", top: "var(--space-1)", right: "var(--space-2)" }}>
          <HelpDot ariaLabel="How the filter works" node="help" />
        </div>
        <SheetTitle node="title">What the search shows</SheetTitle>
        <FilterSection label="Kinds" hint="Combine as many as you like. All, until you narrow it." node="kinds">
          {FEED_KINDS.map((kind) => (
            <Chip key={kind.value} label={kind.label} selected={false} node={`${kind.value}Chip`} />
          ))}
        </FilterSection>
        <OrderSection order="ranked" node="order" />
        <FilterFoot node="foot" />
      </BottomSheet>
    </>
  );
}
