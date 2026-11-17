/* THE POST'S CROP IN A SHORT, WIDE WINDOW (round 52, jakob 2026-11-17,
   decision 3; his hand test's W22: three pictures in a desktop browser, and
   "the small square versions of all 3 images … sit too low. cut in half").

   THE BOARD IS SHORT AND WIDE, BECAUSE THE WINDOW IS THE STATE — the way
   `ReaderPostMenuNarrow` is drawn at 320 and `ViewerLandscape` rotated: a
   browser window 672 wide, the web column's own `max-width: 42rem`, and
   720 high. At that column the stage would stand 672 × 841 and the strip
   and `Next` would fall below the window. The stage is capped instead: the
   window leaves 720 − 328 = 392 for it once the header, the shape row, the
   zoom, the line, the strip, `Next` and their gaps have their place, so it
   stands 313.28 × 392 — its 390 : 488 kept — centred in the column, and
   every frame inside it scales by the same 392 ∕ 488: Tall fills it, Square
   stands 313.28 × 313.28 at 39.36, Wide 313.28 × 163.87 at 114.07. Nothing
   scrolls and nothing is cut off; the blocks around the stage keep their
   sizes. Under a 240-high stage the page would scroll under the pinned
   `Next` instead (readme §13, the compose flow's crop).

   NOTHING ELSE MOVES. Same body (`ComposeCropBody`), same words, the third
   picture in the strip the one this window was opened with. The phone's
   board stays the master.

   REGISTERED under the `composeCrop` prefix: the same surface `ComposeCrop`
   draws, so it rides that board's paths. */
export const NODE = "composeCrop";
export const FRAME = { width: 672, height: 720 };
export const PROPS = { shape: { editor: "enum", options: ["tall", "square", "wide"], default: "tall" } };
export const VALS = COMPOSE_CROP_VALS;

export function Screen() {
  return <ComposeCropBody stage={{ width: 313.28, height: 392 }} pictures={["post-photo.jpg", "inviter.jpg", "gallery-market.jpg"]} />;
}
