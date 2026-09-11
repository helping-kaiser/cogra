/* THE CLIP'S THREE SHAPES IN A CARD (jakob 2026-09-10, the video-cover round).
   The 4:5 clamp was confirmed rather than revised — "taller than 4:5 is
   reserved for the reel scroller" — and confirming a clamp is worth nothing
   unless the three presentations can be held against each other. So they are,
   on one board, in the order a clip grows taller:

   · HORIZONTAL 16:9 — displays TRUE. A wide clip is never made tall.
   · SQUARE 1:1 — displays TRUE.
   · VERTICAL 9:16 — CENTRE-CROPS to 4:5, filled, never fitted. The full frame
     lives on the stream and in the viewer; a card is a place you pass through,
     and a 9:16 tile in it eats the screen the feed is supposed to scroll.

   THE COVERS SAY THE OTHER RULING. The two that display true wear a cover,
   because a horizontal or square clip meets the frame picker; the vertical one
   wears its FIRST FRAME, because a vertical clip's default is no cover. Nothing
   in the card distinguishes them — a still is a still — which is the point: the
   difference is authoring, and the reader never meets it.

   AND THE HEIGHT CAP IS WHAT YOU ACTUALLY SEE. Shape is only half the answer:
   a post fits the screen, so `--media-max-height` bounds every tile, and at a
   phone's 390×844 it lands at 376px. A 16:9 clip is 219px and never reaches it;
   a 1:1 clip wants 390 and a 4:5 clip wants 487, so BOTH stand at 376, filled.
   The crop vocabulary is not what reshapes them — it never governs a clip — the
   cap is, exactly as the reel round said it would. That is the presentation,
   and a board claiming three distinct heights would be the flattering version.

   THIS IS A REFERENCE BOARD, not a screen a reader stands on. Three whole video
   cards do not fit a phone and are not meant to: a feed shows one at a time, as
   `FeedCover` draws it. So the board exports a tall `FRAME`, for the reason
   `Settings` does — the thing it records is a comparison, and a comparison cut
   off at 844px is one nobody can make.

   WHICH IS WHY THE CAP IS PINNED HERE. `--media-max-height` is measured against
   the VIEWPORT, and this board's frame is not a viewport — left alone it would
   hand these tiles a 1503px screen's budget and draw a feed no phone shows. So
   the three clips carry the cap's own formula with a phone's height written in
   where `100dvh` stands. Everything else on the board is the feed's own. */
const PHONE_MEDIA_CAP =
  "calc(844px - 44px - var(--bottom-bar-height) - var(--post-chrome-height))";

const onAPhone = (post) => ({
  ...post,
  media: post.media.map((item) => ({ ...item, maxHeight: PHONE_MEDIA_CAP })),
});

export const FRAME = { width: 390, height: 1934 };

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <PostCard {...onAPhone(TOBIAS_CANOE_POST)} bundle={mkBundle(0.1, 0.1)} />
        <PostCard {...onAPhone(ADA_GRAPES_POST)} bundle={mkBundle(0.2, 0.1)} />
        <PostCard
          {...onAPhone({ ...MIRA_CLIP_POST, media: [{ ...CLIP_LAKESIDE, resting: true }] })}
          bundle={mkBundle(0.3, 0.15)}
        />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
