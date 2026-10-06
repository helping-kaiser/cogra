/* HISTORY · what it shows — the sheet the history's worded trigger opens (the
   History redesign, 2026-10-05: "ofcourse it should be filterable"). The
   feed's filter idiom, scoped to history; its composition stands as drawn
   (jakob 2026-10-05, "canvas looks good").

   KINDS, AND ONLY KINDS. The kind list is `FEED_KINDS` — one list, so the
   history gains a kind the round the feed does. The feed sheet's other
   sections have no work here: the order is the history's one order,
   newest-seen first; the seen toggle would choose between a list of seen
   things and nothing; the forms, what else is admitted and the topic are
   the feed's narrowings, and none is ruled for this list.

   SEARCH'S KIND SEMANTICS, AND SEARCH'S HINT. A reader opening their history
   is looking for one thing they met, so the list starts whole: no chip
   selected means every kind, a chip narrows, and the hint says so in
   search's own words. The trigger at rest reads `Everything`, as search's
   does.

   IT STAGES, AND `Done` COMMITS (the sheet law, readme §4, *Sheets*). The
   feed beneath is visual only and does not move until Done, when the
   history re-reads once; the scrim, a swipe down, system Back and Escape discard. The foot
   is every filter sheet's `FilterFoot`, and its `Reset` stages the history's
   own default — nothing narrowed. Settings holds no default for this list,
   so there is no reader's default to restore and nothing to say about one.

   NO "?" ON THIS SHEET. The feed's and search's filter dialog explains the
   settings default, which this list does not have, so none is drawn. A
   `Done` that narrows the list to nothing lands on `HistoryNone`. The sheet
   is short enough that its content sizes it. */
export function Screen() {
  return (
    <>
      <PageHeader title="History" backHref="#" backLabel="Back to your profile" />
      <div style={{ flex: "none" }}>
        <SearchBar placeholder="Search your history" ariaLabel="Search your history" />
        <div style={{ display: "flex", alignItems: "center", padding: "0 16px 8px 16px" }}>
          <FilterTrigger reading="Everything" ariaLabel="What your history shows" expanded />
        </div>
      </div>
      <FeedList>
        <CommentFeedCard
          author={TOBIAS}
          content={TOBIAS_COMMENT}
          timestamp="1h"
          parent={ADA_POST}
          topics={["glovebox", "coastroad"]}
          score="12.40"
        />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
      </FeedList>
      <BottomNav active={null} slots={ALL_SLOTS} inline />

      <BottomSheet open ariaLabel="What your history shows">
        <SheetTitle>What your history shows</SheetTitle>
        <FilterSection label="Kinds" hint="Combine as many as you like. All, until you narrow it.">
          {FEED_KINDS.map((kind) => (
            <Chip key={kind.value} label={kind.label} selected={false} />
          ))}
        </FilterSection>
        <FilterFoot />
      </BottomSheet>
    </>
  );
}
