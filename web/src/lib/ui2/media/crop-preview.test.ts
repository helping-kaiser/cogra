// The downstream half of the crop step: given a framing, where the picture has
// to sit for a box to show exactly that framing.
//
// These numbers are the whole of jakob's round-6 report that "the previews on
// the next pages afterwards should display the cropped version so that people
// dont think it has reset" — every authoring surface after the crop step draws
// through this function, so a regression here is that bug coming back.

import { describe, expect, it } from "vitest";

import { CENTERED, type Crop } from "./crop";
import { cropAspect, cropPreviewStyle } from "./crop-preview";

/** A framing of an 800x1000 source: the middle 800x500 band of it. */
const BAND: Crop = {
  x: 0,
  y: 0,
  zoom: 1,
  area: { x: 0, y: 100, width: 800, height: 500 },
  areaPercent: { x: 0, y: 10, width: 100, height: 50 },
};

/** The whole of a 1000x1000 source. */
const WHOLE: Crop = {
  x: 0,
  y: 0,
  zoom: 1,
  area: { x: 0, y: 0, width: 1000, height: 1000 },
  areaPercent: { x: 0, y: 0, width: 100, height: 100 },
};

function px(value: string | number | undefined): number {
  return Number(String(value).replace("px", ""));
}

describe("showing a framing on a thumbnail", () => {
  it("scales the source so the framing covers the box, and slides it into place", () => {
    const style = cropPreviewStyle(BAND, { width: 48, height: 48 })!;

    // The band is 800x500 of an 800x1000 source. Covering a 48px square means
    // matching the SHORT side — 48/500 — so the picture is drawn at 0.096.
    expect(px(style.width)).toBeCloseTo(76.8, 5);
    expect(px(style.height)).toBeCloseTo(96, 5);
    // The 76.8-wide band is centred in the 48 box, and the band starts 100
    // source pixels down, so the picture rides up by 100 * 0.096.
    expect(px(style.left)).toBeCloseTo(-14.4, 5);
    expect(px(style.top)).toBeCloseTo(-9.6, 5);
    expect(style.position).toBe("absolute");
    // The tile is meant to be overflowed and trimmed by its parent.
    expect(style.maxWidth).toBe("none");
  });

  it("leaves an unframed square picture exactly filling a square box", () => {
    const style = cropPreviewStyle(WHOLE, { width: 48, height: 48 })!;
    expect(px(style.width)).toBeCloseTo(48, 5);
    expect(px(style.height)).toBeCloseTo(48, 5);
    expect(px(style.left)).toBeCloseTo(0, 5);
    expect(px(style.top)).toBeCloseTo(0, 5);
  });

  it("recovers the source's own extent from the two units, not from the picture", () => {
    // Nothing here decodes anything: 800 / (100/100) and 500 / (50/100) ARE the
    // source's 800x1000, which is what makes a pure-CSS preview possible.
    const wide = cropPreviewStyle(BAND, { width: 800, height: 500 })!;
    expect(px(wide.width)).toBeCloseTo(800, 5);
    expect(px(wide.height)).toBeCloseTo(1000, 5);
    expect(px(wide.top)).toBeCloseTo(-100, 5);
  });

  it("draws nothing special until the framing has actually been measured", () => {
    // A pick nobody has framed yet, an old draft that predates the
    // percentages, and a box with no size — each falls back to the plain fit.
    expect(cropPreviewStyle(CENTERED, { width: 48, height: 48 })).toBeNull();
    expect(cropPreviewStyle({ ...BAND, areaPercent: null }, { width: 48, height: 48 })).toBeNull();
    expect(cropPreviewStyle(BAND, { width: 0, height: 48 })).toBeNull();
    expect(cropPreviewStyle(null, { width: 48, height: 48 })).toBeNull();
    expect(cropPreviewStyle(undefined, { width: 48, height: 48 })).toBeNull();
  });

  it("reports the framing's own shape for a box that should take it", () => {
    expect(cropAspect(BAND)).toBeCloseTo(1.6, 5);
    expect(cropAspect(WHOLE)).toBeCloseTo(1, 5);
    expect(cropAspect(CENTERED)).toBeNull();
  });
});
