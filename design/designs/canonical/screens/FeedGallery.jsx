/* The gallery post in the feed (media slice, 2026-08-31): four pictures, one
   crop shape (tall), one frame swiped — dots only, no count pill. The card's
   height is one frame's height however many pictures ride it; the cap is ten.
   The post itself lives in _shared.jsx now that its detail view draws it too. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <PostCard {...MIRA_GALLERY_POST} bundle={mkBundle(0.3, 0.15)} />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
