/* The post ladder — the maximal collapsed card, held under the height cap
   by the system itself: the media honors --media-max-height, the title and
   description clamp, topics and citations share one line. */
export function Screen() {
  return (
    <>
      <CograBand />
      <FeedList>
        <PostCard
          author={SOL}
          title="Salt maps of the coast road, walked three weekends at low tide"
          description="Rubbings from three weekends at low tide — paper against the salt crust, the side of a wax stick, and whatever the wind allowed."
          content="Three weekends of walking the same stretch at low tide, tracing where the salt crust draws its lines."
          timestamp="3d"
          media={[{ src: "post-photo.jpg", ratio: "tall", fit: "cover" }]}
          topics={["fieldnotes", "coastroad"]}
          references={1}
          score="9.10"
          comments={2}
          bundle={null}
          license={{ attribution: 0.5, provenance: 0.5 }}
          menuItems={CITE_MENU}
        />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
