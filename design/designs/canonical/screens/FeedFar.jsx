/* Far from the default — more flips than a pill can spell. The kinds still
   show (three collapse to a count of their own) and everything else becomes a
   count of changes: "3 kinds · 4 changes". Which four ways is what the sheet
   is for. */
const FAR = { kinds: ["posts", "comments", "chats"], forms: ["photos"], order: "newest", seen: true, also: ["sensitive"] };

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter value={FAR} />} />
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
        <PostCard {...SOL_POST} bundle={mkBundle(0.3, 0.45)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
