/* THE POST'S CROP (legacy conversion, the conformance round): one shape for
   the whole post, chosen here and applied to every picture in it.

   ONE CROP MODEL, ON BOTH CLIENTS (jakob 2026-11-11, seam 301: "the instagram
   approach (fixed frame with mooving and zooming image)"). The FRAME is
   fixed: it stands still at the chosen shape, and the PICTURE is what moves
   (drag) and zooms (pinch, or the zoom track) under it. No window ever moves
   over a still picture, and the stage never changes size with the shape.

   THE STAGE IS ONE SIZE UNDER EVERY SHAPE: 390 × 488, the column's full
   width at 4:5. The frame changes shape inside it, the largest of its shape
   the stage holds, centred — Tall 4:5 fills it (390 × 488), Square 1:1 stands
   390 × 390 at top 49, Wide 1.91:1 stands 390 × 204 at top 142 (390 ÷ 1.91 =
   204.2). The `shape` chip draws each. Outside the frame the picture stays in
   view, darkened by the one box shadow `CropViewport` masks with (45 % black,
   its construction); under Tall nothing is outside.

   THE SHAPE CHIPS ARE THE DIFFERENCE FROM THE OTHER TWO CROPS, and the reason
   this board draws its own stage rather than taking `CropViewport`. A profile
   picture is shown in a circle and a video's cover at the clip's ratio, so both
   are cut at a LOCKED shape inside a square stage; a post's shape is the
   author's, so this stage is the tallest shape's and the thirds guides a
   composition decision needs are drawn on the frame.

   THE STRIP IS `MediaThumb`, dressed the way `CoverRow` dresses its frames:
   the framed picture takes the primary outline offset off the tile, the rest
   sit at 65%. Selection by outline and not by badge, for the same reason —
   at 48px a badge covers the thing being chosen.

   THE ZOOM IS ON SCREEN, AND THE PICTURE PANS BY KEY (the K13 round): the
   master's `CropZoom` under the stage, its thumb at this crop's 1.15× between
   the fill (1×) and 10×, on both platforms; the stage takes focus under
   `CropViewport`'s name and its arrow keys move the picture, stopping where an
   edge of the picture meets the frame's — 1 % a press, 10 % with Shift (jakob
   2026-10-05). The line under the zoom says what the crop decides, `One shape
   for the whole post.`, and nothing about how to move it (round 44, the
   removable-text pass: the how-to line goes on every crop).

   REGISTERED under its own `composeCrop` prefix (seam 248): `header`, the
   `shapes` chips (`tallChip`, `squareChip`, `wideChip`, a filter's
   `<value>Chip` naming — drawn once, the `shape` setting re-selecting it, so
   unkeyed, round 49), the
   `viewport`, the `zoom` slider, the `howTo` line, the `pictures` strip with
   one `thumb` per picture keyed by its place, and `next`. */
export const NODE = "composeCrop";
export const PROPS = { shape: { editor: "enum", options: ["tall", "square", "wide"], default: "tall" } };
/* The body is `ComposeCropBody` (`_shared.jsx`), drawn at a 390 column here
   and in a short, wide window on `ComposeCropShort`. */
export const VALS = COMPOSE_CROP_VALS;

export function Screen() {
  return <ComposeCropBody />;
}
