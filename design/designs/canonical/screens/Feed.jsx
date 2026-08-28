/* The everyday feed — a member signed in, the filter's trigger at rest on the
   band's right edge (item 19: the band never spends its full width on identity
   alone; the trigger scrolls away and back with it). At the default it reads
   just the kinds: "Posts". */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
