/* The post ladder — the maximal collapsed card, held in shape by the system
   itself: the title clamps to one line and the description to two, tags and
   citations share one line, and the media stands at its own 4:5. That last one
   is what runs the card past the fold, which is the ruling: a vertical post
   scrolls (jakob 2026-09-11). What this board records is that everything ELSE
   is bounded — the card grows by its picture's shape and by nothing else. */
export function Screen() {
  return (
    <>
      <CograBand />
      <FeedList>
        <PostCard
          author={SOL}
          title="Salt maps of the coast road, walked three weekends at low tide"
          description="Rubbings from three weekends at low tide — paper against the salt crust, the side of a wax stick, and whatever the wind allowed."
          timestamp="3d"
          media={[{ src: "post-photo.jpg", ratio: "tall", fit: "cover" }]}
          topics={["fieldnotes", "coastroad"]}
          references={1}
          score="9.10"
          comments={2}
          bundle={null}
          license={{ attribution: 0.5, provenance: 0.5 }}
          menuItems={CARD_MENU}
        />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
