/* The post ladder — a post wearing MANY topics (50 is legal). ONE line
   whatever the count, on both variants: two chips, then the counts in words;
   on detail the line is the topics-and-references sheet's opener — the sheet
   is the full set's home. */
const MANY_TOPICS = [
  "coastroad", "saltmarsh", "headland", "lowtide", "fieldnotes", "placenames",
  "ferrylanding", "springtide", "waxstick", "rubbings", "papercraft", "maps",
  "walking", "shoreline", "driftwood", "estuary", "tidepools", "seabirds",
  "lighthouse", "harbour", "dunes", "marram", "shingle", "breakwater",
  "slipway", "mudflats", "causeway", "quay", "pilotage", "moorings",
  "beacons", "charts", "soundings", "currents", "eddies", "narrows",
  "sandbars", "reeds", "brack", "sluice", "polder", "dyke",
  "foreshore", "wrack", "spume", "fetch", "leeward", "windward",
  "neap", "ebb",
];

export function Screen() {
  return (
    <>
      <CograBand />
      <FeedList>
        <PostCard
          author={ADA}
          content="Every place name on the coast road, collected over a year of walking it."
          timestamp="1d"
          topics={MANY_TOPICS.slice(0, 14)}
          references={3}
          score="6.30"
          comments={1}
          license={{ attribution: 1, provenance: 0 }}
          menuItems={CITE_MENU}
          bundle={null}
        />
        <PostCard
          variant="detail"
          author={ADA}
          content="Every place name on the coast road, collected over a year of walking it."
          timestamp="1d"
          topics={MANY_TOPICS}
          references={3}
          score="6.30"
          comments={1}
        />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
