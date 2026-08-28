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
          sensitive={{ reason: "One rubbing includes a dead seabird." }}
          score="9.10"
          comments={2}
          bundle={null}
          license={{ attribution: 0.5, provenance: 0.5 }}
          menuItems={CITE_MENU}
        />
        {/* A redacted record keeps its menu — the licence rode the payload and is
            gone, but the record can still be cited: it never left the graph. */}
        <PostCard author={ADA} content="" timestamp="1w" redacted={{ reason: "author" }} score="15.20" comments={3} menuItems={CITE_MENU} />
        <PostCard author={TOBIAS} content="" timestamp="2w" redacted={{ reason: "illegal" }} score="4.70" comments={1} menuItems={CITE_MENU} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
