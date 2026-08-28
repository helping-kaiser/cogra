/* The feed, narrowed — the trigger speaks the deviations while they fit:
   "Posts · photos · newest". Past the pill's budget they collapse to a count
   ("Posts · 3 changes"). The feed behind it obeys: photo posts, newest
   first. */
const NARROWED = { kinds: ["posts"], forms: ["photos"], order: "newest", seen: true, also: [] };

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter value={NARROWED} />} />
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
        <PostCard {...SOL_POST} bundle={mkBundle(0.3, 0.45)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
