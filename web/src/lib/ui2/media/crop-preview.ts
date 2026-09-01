// Showing a framing on a thumbnail — the downstream half of the crop step.
//
// WHY THIS EXISTS (jakob, round 6): "the previews on the next pages afterwards
// should display the cropped version so that people dont think it has reset".
// An author frames a picture, walks on to the details, and sees the WHOLE
// picture again on the picked row — which reads as the crop having been thrown
// away. It was not; the row simply drew the source. Every authoring surface
// downstream of the crop step now draws the framing instead.
//
// WHY IT IS CSS AND NOT A SECOND ENCODE. The bytes are cropped once, at upload
// (`encodeForUpload`), and re-encoding a 48px tile per picture per render would
// spend real time to show something a transform already shows exactly. An
// uploaded picture carries its crop baked in and needs none of this; this is
// only for the picks still on the device.
//
// THE MATH NEEDS THE SOURCE'S EXTENT, and the pair of units in `Crop` is what
// supplies it. `area` is the framing in source pixels; `areaPercent` is the
// same rectangle as a fraction. Divide one by the other and the source's own
// width and height fall out, with nothing decoded and nothing measured — which
// is why the frame stores both (see `crop.ts`).
//
// The framing is COVER-fitted into the box rather than stretched to it: a 4:5
// framing in a 48px square tile would otherwise be squashed, and a squashed
// preview is a different lie from the one this fixes.

import type { CSSProperties } from "react";

import { usableArea, type Crop, type CropArea } from "./crop";

/** The box the framing has to fill, in CSS pixels. */
export type PreviewBox = { readonly width: number; readonly height: number };

/**
 * Where the picture must sit inside `box` for the box to show `crop`'s framing,
 * as styles for an absolutely positioned `<img>` in a `position: relative`,
 * `overflow: hidden` parent.
 *
 * Null when the framing is not knowable — nothing has been measured yet, an old
 * draft predates the percentages, or the numbers are degenerate. A caller that
 * gets null draws the picture the way it always did.
 */
export function cropPreviewStyle(
  crop: Crop | null | undefined,
  box: PreviewBox,
): CSSProperties | null {
  if (crop === undefined || crop === null) return null;
  const source = sourceSize(crop.area, crop.areaPercent);
  if (source === null || !usableArea(crop.area)) return null;
  if (!(box.width > 0) || !(box.height > 0)) return null;

  const area = crop.area;
  // Cover: the framing is scaled until it covers both axes, so the tile is
  // never letterboxed and the overflow is trimmed evenly on the long one.
  const scale = Math.max(box.width / area.width, box.height / area.height);
  const shownWidth = area.width * scale;
  const shownHeight = area.height * scale;

  return {
    position: "absolute",
    width: `${source.width * scale}px`,
    height: `${source.height * scale}px`,
    // The framing is centred in the box, then the picture is slid so the
    // framing's own top-left corner lands on the framing's position.
    left: `${(box.width - shownWidth) / 2 - area.x * scale}px`,
    top: `${(box.height - shownHeight) / 2 - area.y * scale}px`,
    // The tiles live under `max-w-full` rules; the picture here is meant to
    // overflow its box, which is what the parent's `overflow: hidden` trims.
    maxWidth: "none",
    maxHeight: "none",
  };
}

/**
 * The framing's own aspect, for a box that should take the framing's shape
 * rather than crop into it — the describe sheet's preview. Null when unknown.
 */
export function cropAspect(crop: Crop | null | undefined): number | null {
  if (crop === undefined || crop === null || !usableArea(crop.area)) return null;
  return crop.area.width / crop.area.height;
}

/** The source picture's own pixel extent, recovered from the two units. */
function sourceSize(
  area: CropArea | null,
  percent: CropArea | null,
): { width: number; height: number } | null {
  if (!usableArea(area) || !usableArea(percent)) return null;
  const width = (area.width * 100) / percent.width;
  const height = (area.height * 100) / percent.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}
