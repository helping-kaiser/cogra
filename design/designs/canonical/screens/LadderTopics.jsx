/* The post ladder — a post wearing MANY tags (50 is legal). ONE line
   whatever the count, on both variants: up to two chips whole, then the
   counts in words; on detail the line is the tags-and-references sheet's
   opener — the sheet is the full set's home. The second tag here,
   "weatherwatching", is long enough that its chip doesn't clear the line's
   budget beside the first — this board is where that fold shows: one chip,
   not two, and the folded tag's count joins the rest.

   THE MIDDLE CARD IS THE FOLD'S FLOOR: one tag, and it is too long to be a
   chip at all. `TopicsLine` never cuts a tag to make it fit, so with nothing
   that fits there is nothing to show — the line falls all the way to its
   words, "· 1 tag", and that is the whole line. It is the state the fold
   logic always had and no board drew: two chips, then one, then none. */
const MANY_TOPICS = [
  "coastroad", "weatherwatching", "headland", "lowtide", "fieldnotes", "placenames",
  "ferrylanding", "springtide", "waxstick", "rubbings", "papercraft", "maps",
  "walking", "shoreline", "driftwood", "estuary", "tidepools", "seabirds",
  "lighthouse", "harbour", "dunes", "marram", "shingle", "breakwater",
  "slipway", "mudflats", "causeway", "quay", "pilotage", "moorings",
  "beacons", "charts", "soundings", "currents", "eddies", "narrows",
  "sandbars", "reeds", "brack", "sluice", "polder", "dyke",
  "foreshore", "wrack", "spume", "fetch", "leeward", "windward",
  "neap", "ebb",
];

/* One tag, long enough that its chip alone overruns the line's 358px budget
   — so no chip is drawn and the count speaks for it. */
const OVERLONG_TOPIC = "everyplacenameonthecoastroadandwhatlocalscallthem";

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
          author={ADA}
          content="The full list, finally — including the three the maps still disagree about."
          timestamp="1d"
          topics={[OVERLONG_TOPIC]}
          score="4.10"
          comments={2}
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
