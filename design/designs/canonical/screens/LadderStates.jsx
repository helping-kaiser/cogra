/* The post ladder — the marked states: veiled, and the two removals. */
export function Screen() {
  return (
    <>
      <CograBand />
      <FeedList>
        <PostCard
          author={SOL}
          title="Salt maps of the coast road"
          description="Rubbings from three weekends at low tide — paper against the salt crust."
          timestamp="3d"
          media={[{ src: "post-photo.jpg", ratio: "landscape", fit: "cover" }]}
          sensitive={{ label: "One rubbing includes a dead seabird." }}
          score="9.10"
          comments={2}
          bundle={null}
        />
        <PostCard author={ADA} content="" timestamp="1w" redacted={{ reason: "author" }} score="15.20" comments={3} />
        <PostCard author={TOBIAS} content="" timestamp="2w" redacted={{ reason: "illegal" }} score="4.70" comments={1} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
