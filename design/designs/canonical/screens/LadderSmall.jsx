/* The post ladder — the small forms a card can take in the feed. */
export function Screen() {
  return (
    <>
      <CograBand />
      <FeedList>
        <PostCard {...TOBIAS_POST} bundle={null} />
        <PostCard
          author={ADA}
          content=""
          timestamp="4h"
          media={[{ src: "post-photo.jpg", ratio: "landscape", fit: "cover" }]}
          bundle={mkBundle(0.1, 0.1)}
          score="11.40"
          comments={2}
          license={{ attribution: 1, provenance: 0 }}
          menuItems={CITE_MENU}
        />
        <PostCard
          author={SOL}
          title="Notes from the third headland, second visit"
          content="A short one this time. The crust was thinner than last month and the lines wander further inland, which I did not expect this early in the season."
          timestamp="6h"
          score="4.20"
          comments={0}
          license={{ attribution: 0, provenance: 0 }}
          menuItems={CITE_MENU}
        />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
