/* THE COVER AT REST, and the card that never starts (readme §13, the reel
   round). Two states of the same card, drawn together because the difference
   between them is one control.

   ABOVE — the SUPPRESSED-AUTOPLAY card: the device asked for no motion (reduced
   motion, data saver), so nothing is going to start on its own, and the PLAY
   DISC takes the sound disc's place. It is the one card in the product that
   draws play, and a tap plays it here, in the feed, where it stands. Its clip is
   9:16 and the card stands it at 4:5, centre-cropped — the crop the whole round
   turns on, at full height so it can be checked. The post carries no words,
   which is the ordinary shape of a clip post.

   BELOW — the same card with autoplay on, at its FIRST PAINT: the cover, before
   playback starts. It holds until the clip starts and never returns, and the
   card carries the sound disc and nothing else. Its clip is 16:9 and displays
   true — a wide clip is never made tall.

   THE ORDER IS THE BOARD'S, NOT THE PRODUCT'S. A phone shows one whole video
   card at a time, so the second is cut by the board's edge the way a feed's next
   card always is; the suppressed card leads because its chrome is the state
   nothing else in the canvas draws. */
const SUPPRESSED = {
  ...MIRA_CLIP_POST,
  title: undefined,
  description: undefined,
  topics: [],
  media: [{ ...CLIP_LAKESIDE, resting: true, controls: "play" }],
};

const AT_REST = {
  author: TOBIAS,
  title: "Crossing at the narrows before the wind got up",
  description: "Four of us out, one camera wedged in the bow. The far bank is closer than it looks from the road.",
  timestamp: "2h",
  media: [
    {
      kind: "video",
      src: "clip-canoe.mp4",
      poster: "clip-canoe.jpg",
      ratio: "landscape",
      resting: true,
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
        <PostCard {...SUPPRESSED} bundle={mkBundle(0.3, 0.15)} />
        <PostCard {...AT_REST} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
