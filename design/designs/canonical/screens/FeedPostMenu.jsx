/* THE FEED, ITS POST MENU OPEN (jakob 2026-10-09, ruling 84; the shape ruled
   2026-10-07, ruling 53). The same sheet `ReaderPostMenu` masters, on its
   second host: a card's ⋮ in the feed raises it over the column the tap was
   made in, and the hosting-surface rule gives the drawn state its own paths —
   `feed.menuSheet.*`, mirroring `postDetail.menuSheet`'s. Registration
   follows this drawn feed-hosted state; the paths were never pre-registered.

   NOTHING ABOUT THE SHEET IS THIS BOARD'S OWN. The rows are
   `READER_POST_MENU`, the one atom the detail's board and the header's ⋮
   read — Save, Cite, Hide @ada, License terms, Report at the tail (ruling
   75) — so the feed's sheet and the detail's cannot disagree. What differs
   is beneath: the feed stands under the wash exactly as `Feed` draws it,
   and the acts' aftermaths land on the feed's own boards — Hide on
   `FeedHidden`, the hide's rows leaving at once because the feed is where
   the tap was made.

   REGISTERED under the `feed` prefix: the page as `Feed` names it, the
   sheet `menuSheet` with one name per row, as every menu's. */
export const NODE = "feed";
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band" />
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />

      <BottomSheet open ariaLabel="Post actions" node="menuSheet">
        {READER_POST_MENU.map((item) => (
          <SheetItem key={item.label} label={item.label} node={item.node} />
        ))}
      </BottomSheet>
    </>
  );
}
