import { describe, expect, it } from "vitest";

import { POST_SHAPES } from "./aspect";
import { fittedPicture, frameOf, stageOf, zoomBounds, type CropArea, type CropKind, type Size } from "./crop";
import { sourceRect } from "./encode-image";

const limit = (max: number, value: number) => Math.min(max, Math.max(0, value));

/**
 * The library's measured rectangle, line for line: react-easy-crop 6.2.4
 * `computeCroppedArea` (index.module.mjs:113-142, rotation 0, the position
 * restricted), whose `aspect` is `getAspect()` — the `cropSize`'s own where
 * one is given, the `aspect` prop's otherwise.
 */
function cropAreaOf(
  crop: { x: number; y: number },
  zoom: number,
  media: Size,
  cropSize: Size,
  natural: Size,
  aspect = cropSize.width / cropSize.height,
): CropArea {
  const percent = {
    x: limit(100, (((media.width - cropSize.width / zoom) / 2 - crop.x / zoom) / media.width) * 100),
    y: limit(100, (((media.height - cropSize.height / zoom) / 2 - crop.y / zoom) / media.height) * 100),
    width: limit(100, ((cropSize.width / media.width) * 100) / zoom),
    height: limit(100, ((cropSize.height / media.height) * 100) / zoom),
  };
  const widthInPixels = Math.round(limit(natural.width, (percent.width * natural.width) / 100));
  const heightInPixels = Math.round(limit(natural.height, (percent.height * natural.height) / 100));
  const size =
    natural.width >= natural.height * aspect
      ? { width: Math.round(heightInPixels * aspect), height: heightInPixels }
      : { width: widthInPixels, height: Math.round(widthInPixels / aspect) };
  return {
    ...size,
    x: Math.round(limit(natural.width - size.width, (percent.x * natural.width) / 100)),
    y: Math.round(limit(natural.height - size.height, (percent.y * natural.height) / 100)),
  };
}

// THE CROP'S OUTPUT DOES NOT CHANGE WITH THE MODEL (seam 301: "The crop's
// OUTPUT (what is uploaded) does not change with this ruling").
//
// What is uploaded is `encodeForUpload(source, { crop: { area }, ratio })` —
// the encoder is untouched, so the same area gives the same bytes. What the
// model changes is only the geometry the library's area is measured in. The
// library's measurement (react-easy-crop 6.2.4 `computeCroppedArea`, mirrored
// by `cropAreaOf`) is pinned here against the two places an area comes from:
//
//  · AT REST — a picture nobody moved. The old frame laid the cut as the
//    largest rectangle of the shape inside the picture fitted in a box of the
//    shape, at 1×; the new one stands the fixed frame at the fill. Both must
//    be the source's largest rectangle of the shape, centred — `sourceRect`,
//    the encoder's own fallback — for every shape and every kind of picture.
//  · MOVED — a picture panned and zoomed to show a region: the area is that
//    region, whatever stage it was framed on.

const SOURCES: readonly [string, Size][] = [
  ["a camera landscape", { width: 4000, height: 3000 }],
  ["a camera portrait", { width: 3000, height: 4000 }],
  ["a square", { width: 2048, height: 2048 }],
  ["a panorama", { width: 12000, height: 2000 }],
  ["a phone screenshot", { width: 1170, height: 2532 }],
  ["a tiny picture", { width: 40, height: 30 }],
];

const FRAMES: readonly [string, CropKind, number][] = [
  ["Tall", "post", POST_SHAPES.tall.ratio],
  ["Square", "post", POST_SHAPES.square.ratio],
  ["Wide", "post", POST_SHAPES.wide.ratio],
  ["a 16:9 cover", "cover", 16 / 9],
  ["a tall cover", "cover", 4 / 5],
  ["a comment's square cover", "cover", 1],
  ["the circle", "avatar", 1],
];

/**
 * The old frame's resting cut (main at bbc768c45, crop-frame.tsx): a box of
 * the post's shape — a square for a cover or the circle — the picture fitted
 * whole into it at 1×, the cut the library's `getCropSize` inside both, and
 * the `aspect` prop the exact ratio (no `cropSize` was given).
 */
function oldRestingArea(kind: CropKind, source: Size, ratio: number, width: number) {
  const box = { width, height: kind === "post" ? width / ratio : width };
  const picture = fittedPicture(source, box);
  const fitW = Math.min(picture.width, box.width);
  const fitH = Math.min(picture.height, box.height);
  const cut = fitW > fitH * ratio ? { width: fitH * ratio, height: fitH } : { width: fitW, height: fitW / ratio };
  return cropAreaOf({ x: 0, y: 0 }, 1, picture, cut, source, ratio);
}

function newRestingArea(kind: CropKind, source: Size, ratio: number, width: number) {
  const picture = fittedPicture(source, stageOf(kind, width));
  const frame = frameOf(kind, ratio, width);
  return cropAreaOf({ x: 0, y: 0 }, zoomBounds(kind, picture, ratio, width).floor, picture, frame, source);
}

describe("the crop's output at rest", () => {
  for (const [what, source] of SOURCES) {
    for (const [frame, kind, ratio] of FRAMES) {
      it(`cuts ${what} under ${frame} exactly as before: the largest ${frame} rectangle, centred`, () => {
        for (const width of [390, 412]) {
          const before = oldRestingArea(kind, source, ratio, width);
          const after = newRestingArea(kind, source, ratio, width);
          // Pixel-for-pixel: the library rounds to whole pixels (`Math.round`).
          expect(after).toEqual(before);
          const centred = sourceRect(source.width, source.height, ratio);
          expect(Math.abs(after.width - centred.width)).toBeLessThanOrEqual(1);
          expect(Math.abs(after.height - centred.height)).toBeLessThanOrEqual(1);
          expect(Math.abs(after.x - centred.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(after.y - centred.y)).toBeLessThanOrEqual(1);
        }
      });
    }
  }
});

describe("the crop's output when moved", () => {
  // The same region of a 4000 × 3000 landscape framed Square: its right
  // third, shown at twice the fill. On the old 412 square box the picture laid
  // 412 × 309 and the cut stood 309 × 309; on the new 390 stage it lays
  // 390 × 292.5 under a 390 × 390 frame. Each offset is the one that puts the
  // region's centre under the frame's.
  const SOURCE = { width: 4000, height: 3000 };
  const REGION = { x: 2500, y: 750, width: 1500, height: 1500 };

  /** The offset that shows `REGION` under a frame `cut` on a picture laid `picture` at `zoom`. */
  function offsetFor(picture: Size, zoom: number) {
    const perPixel = (picture.width * zoom) / SOURCE.width;
    const centreX = REGION.x + REGION.width / 2 - SOURCE.width / 2;
    const centreY = REGION.y + REGION.height / 2 - SOURCE.height / 2;
    return { x: -centreX * perPixel, y: -centreY * perPixel };
  }

  it("uploads the region the reader framed, whichever model framed it", () => {
    // Old: a 412 square box; the picture fitted into it, the cut 309 square.
    const oldPicture = fittedPicture(SOURCE, { width: 412, height: 412 });
    const oldCut = { width: 309, height: 309 };
    const oldZoom = (oldCut.width * SOURCE.width) / (REGION.width * oldPicture.width);
    const before = cropAreaOf(offsetFor(oldPicture, oldZoom), oldZoom, oldPicture, oldCut, SOURCE, 1);

    // New: the 390 × 488 stage, the 390 square frame.
    const newPicture = fittedPicture(SOURCE, stageOf("post", 390));
    const frame = frameOf("post", 1, 390);
    const newZoom = (frame.width * SOURCE.width) / (REGION.width * newPicture.width);
    const after = cropAreaOf(offsetFor(newPicture, newZoom), newZoom, newPicture, frame, SOURCE);

    expect(before).toEqual(REGION);
    expect(after).toEqual(REGION);
  });
});
