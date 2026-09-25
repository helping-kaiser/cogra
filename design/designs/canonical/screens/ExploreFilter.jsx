/* The search filter sheet — what the worded trigger opens: the kinds that
   combine, and the one Order section shared with the feed's filter (item 19:
   `OrderSection`, ruled identical on both). The kind list is `FEED_KINDS` —
   one list, "Profiles" everywhere; here nothing is narrowed, so no chip is
   selected and the search reads everything.

   FOUR KINDS, THE FEED'S FOUR (readme §13, the V1.0 scope cut, 2026-09-25):
   Posts, Comments, Profiles, Tags. The list is one, so the two filters trim
   together. The results beneath the sheet are `ExploreSearch`'s first two
   rows, the post and the tag — search returns no item, offer or message rows
   in V1.0. */
export function Screen() {
  return (
    <>
      <div style={{ flex: "none", paddingTop: 12 }}>
        <SearchBar query="@sol salt" />
        <SearchTriggerRow reading="Everything" />
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ReferenceRow kind="post" name="Salt maps of the coast road" src="post-photo.jpg" rank="9.10" onOpen={() => {}} />
        <ReferenceRow kind="topic" name="saltmaps" sub="tagged by @sol" rank="3.40" onOpen={() => {}} />
      </div>
      <BottomNav active="search" slots={ALL_SLOTS} inline />

      <BottomSheet open ariaLabel="What the search shows">
        <div style={{ position: "absolute", top: "var(--space-1)", right: "var(--space-2)" }}>
          <HelpDot ariaLabel="How the filter works" />
        </div>
        <SheetTitle>What the search shows</SheetTitle>
        <FilterSection label="Kinds" hint="Combine as many as you like. All, until you narrow it.">
          {FEED_KINDS.map((kind) => (
            <Chip key={kind.value} label={kind.label} selected={false} />
          ))}
        </FilterSection>
        <OrderSection order="ranked" />
      </BottomSheet>
    </>
  );
}
