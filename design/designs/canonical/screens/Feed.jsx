/* The everyday feed — a member signed in, the filter's trigger at rest on the
   band's right edge (item 19: the band never spends its full width on identity
   alone; the trigger scrolls away and back with it). At the default it reads
   just the kinds: "Posts".

   A CALIBRATION SCREEN (design ⇄ impl seam 002): `NODE` registers the board,
   so its named elements carry `feed.…` data-node paths into the built board and
   `nodes.json`. */
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
    </>
  );
}
