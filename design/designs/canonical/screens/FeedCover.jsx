/* THE COVER AT REST, and the card that never starts (readme §13, the reel
   round). Two states of the same card, drawn together because the difference
   between them is one control.

   ABOVE — a clip's first paint. The cover holds until playback starts and never
   returns: a clip that stops being the playing one freezes on the frame it
   reached. The card carries the sound disc and nothing else; the clip is 9:16
   and stands at 4:5, centre-cropped, because a card never letterboxes.

   BELOW — the same card where the device asked for no motion (reduced motion,
   data saver). Autoplay is absent by the device's own word, so nothing is going
   to start, and the PLAY DISC takes the sound disc's place: the one card in the
   product that draws play. A tap plays it here, in the feed, where it stands.
   Its clip is 16:9 and displays true — a wide clip is not made tall. */
const CLIP_AT_REST = {
  ...MIRA_CLIP_POST,
  media: [{ ...CLIP_LAKESIDE, resting: true }],
};

const SUPPRESSED = {
  author: TOBIAS,
  title: "Crossing at the narrows before the wind got up",
  content: "Four of us out, one camera wedged in the bow. The far bank is closer than it looks from the road.",
  timestamp: "2h",
  media: [
    {
      kind: "video",
      src: "clip-canoe.mp4",
      poster: "clip-canoe.jpg",
      ratio: "landscape",
      resting: true,
      controls: "play",
      alt: "Two canoes crossing a mountain lake.",
    },
  ],
  topics: ["stillwater"],
  score: "4.80",
  comments: 1,
  license: { attribution: 0, provenance: 0 },
  menuItems: CITE_MENU,
};

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <PostCard {...CLIP_AT_REST} bundle={mkBundle(0.3, 0.15)} />
        <PostCard {...SUPPRESSED} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
