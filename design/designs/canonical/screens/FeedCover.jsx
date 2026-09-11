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

   THE FACE UNDER THAT DISC IS A FIRST FRAME, NOT A COVER (jakob 2026-09-10).
   The clip is vertical, and a vertical clip's default is no cover — so what the
   card shows at rest is the clip's own first frame, cropped exactly as the clip
   is. The card cannot tell the two apart and is not asked to: a still is a
   still, and which one it is was settled while the post was written.

   BELOW — the same card with autoplay on, at its FIRST PAINT: the cover, before
   playback starts. It holds until the clip starts and never returns, and the
   card carries the sound disc and nothing else. Its clip is 16:9 and displays
   true — a wide clip is never made tall — and being horizontal it met the frame
   picker, so the still it wears is a chosen cover.

   THE ORDER IS THE BOARD'S, NOT THE PRODUCT'S. A phone shows one whole video
   card at a time, so the second is cut by the board's edge the way a feed's next
   card always is; the suppressed card leads because its chrome is the state
   nothing else in the canvas draws. The three shapes side by side are
   `FeedShapes`, which is a reference board for exactly the reason this one is
   not: comparing them needs a frame no phone has. */
const SUPPRESSED = {
  ...MIRA_CLIP_POST,
  title: undefined,
  description: undefined,
  topics: [],
  media: [{ ...CLIP_LAKESIDE, resting: true, controls: "play" }],
};

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <PostCard {...SUPPRESSED} bundle={mkBundle(0.3, 0.15)} />
        <PostCard {...TOBIAS_CANOE_POST} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
