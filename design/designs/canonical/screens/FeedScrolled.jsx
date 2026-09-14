/* THE FEED, DEEP IN THE LIST, WITH THE WAY BACK UP (jakob's ruling
   2026-09-14). The first board in this tree drawn mid-scroll, because it is the
   first state that only exists there: the reader is three screens down, has
   scrolled up far enough to summon the collapsing band, and the pill has come
   in under it.

   BOTH CARDS ARE CUT, and that is how the board says where the reader is. A
   feed drawn from the first card is a feed at rest whatever else is on it, and
   the pill would read as a thing the feed always carries. The list is pulled up
   so the top card is entered mid-way and the one under it runs off the bottom
   edge: travelled from, and still going. The pair is `FeedNarrowed`'s, which is
   why this board numbers exactly as that one does.

   THE PILL RIDES THE BAND THAT SUMMONED IT. It is drawn where it lives — fixed,
   centred, directly under the collapsing block and never inside it, because
   anything added to that block moves the band's own half-slot threshold and
   re-clamps the list (item 45.3). It sits BENEATH the band in the stack, so
   when the band leaves the pill goes under it rather than over.

   IT COEXISTS WITH THE LADDER'S THIRD RUNG, and this board is where the two are
   visible at once. The Feed slot in the bar, tapped from a scrolled root, goes
   to the top animated; the pill does exactly that and nothing else. One is a
   rung a reader has to be told about, the other says itself — and both land on
   `Feed`, the feed at rest, which is why the graph gives them the same outcome
   rather than two.

   NOTHING ELSE IS DIFFERENT. Same band, same filter at its default, same cards
   the feed draws everywhere else. The state is the scroll and the one control
   the scroll earns. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* The list carried up past its own start: the top card is entered
            mid-way, the way a scrolled list meets its frame. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: -196 }}>
          <PostCard {...SOL_POST} bundle={mkBundle(0.3, 0.45)} />
          <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
        </div>
      </div>
      <BackToTop />
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
