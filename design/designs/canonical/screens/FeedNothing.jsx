/* Everything switched off — allowed at the chip, answered by the feed: the
   empty state says what is off and offers the way back (item 4's rule — the
   control never prevents a choice). The trigger reads "Nothing". */
const NOTHING = { kinds: [], forms: ["text", "photos", "video"], order: "ranked", seen: true, also: [] };

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter value={NOTHING} />} />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 24px" }}>
        <EmptyState title="Your feed admits nothing right now — every kind is switched off." actionLabel="Show posts again" onAction={() => {}} />
      </div>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
