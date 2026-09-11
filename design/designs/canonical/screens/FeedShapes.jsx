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

   AND THE HEIGHTS ARE THE SHAPES' OWN (jakob 2026-09-11). Nothing bounds a tile
   but that 4:5 clamp, so the board shows three distinct heights at one width: at
   390px the 16:9 clip stands 219, the square 390, the 4:5 clip 487. A post fits
   the screen at the first two; the third runs past the fold and the reader
   scrolls to reach its affordances. That is the accepted cost of showing the
   picture at the shape its author gave it — a tile shrunk to keep the card on
   one screen would spend it on every reader, forever.

   THIS IS A REFERENCE BOARD, not a screen a reader stands on. Three whole video
   cards do not fit a phone and are not meant to: a feed shows one at a time, as
   `FeedCover` draws it. So the board exports a tall `FRAME`, for the reason
   `Settings` does — the thing it records is a comparison, and a comparison cut
   off at 844px is one nobody can make. */

export const FRAME = { width: 390, height: 2059 };

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <PostCard {...TOBIAS_CANOE_POST} bundle={mkBundle(0.1, 0.1)} />
        <PostCard {...ADA_GRAPES_POST} bundle={mkBundle(0.2, 0.1)} />
        <PostCard
          {...MIRA_CLIP_POST}
          media={[{ ...CLIP_LAKESIDE, resting: true }]}
          bundle={mkBundle(0.3, 0.15)}
        />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
