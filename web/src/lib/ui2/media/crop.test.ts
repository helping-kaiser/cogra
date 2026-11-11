import { describe, expect, it } from "vitest";

import { POST_SHAPES } from "./aspect";
import {
  CENTERED,
  clampZoom,
  cutOf,
  fittedPicture,
  MAX_ZOOM,
  MIN_ZOOM,
  reshape,
  sourceOf,
  usableArea,
  type Crop,
} from "./crop";

describe("the crop the wizard carries", () => {
  it("starts centred, unzoomed, and unmeasured", () => {
    // Unmeasured in BOTH units: the pixels the encoder bakes and the
    // percentages a downstream preview draws from arrive together or not at all.
    expect(CENTERED).toEqual({ x: 0, y: 0, zoom: MIN_ZOOM, area: null, areaPercent: null });
  });

  it("holds the zoom inside the range the cropper is given", () => {
    expect(clampZoom(0.2)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(1.5)).toBe(1.5);
    expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM);
  });
});

describe("usableArea", () => {
  it("rejects the states the encoder cannot draw from", () => {
    expect(usableArea(null)).toBe(false);
    expect(usableArea(undefined)).toBe(false);
    expect(usableArea({ x: 0, y: 0, width: 0, height: 100 })).toBe(false);
    expect(usableArea({ x: 0, y: 0, width: 100, height: -1 })).toBe(false);
    expect(usableArea({ x: Number.NaN, y: 0, width: 100, height: 100 })).toBe(false);
  });

  it("accepts a measured rectangle", () => {
    expect(usableArea({ x: 10, y: 20, width: 100, height: 125 })).toBe(true);
  });
});

// THE SHAPE CHANGES AROUND THE PICTURE (hand test 2026-11-11: "when swapping
// from tall to square or wide the image shrinks. i would just expect the
// rectangle/frame to change"). ComposeCrop.md:5 says only that every picture
// takes the shape; :29 bounds the zoom between the fill and about 4×. The
// numbers are a 412px frame — the harness's phone width — and the two
// pictures a camera hands over: 4000×3000 landscape and 3000×4000 portrait.
describe("reshape", () => {
  const FRAME = 412;
  const ratio = { tall: POST_SHAPES.tall.ratio, square: POST_SHAPES.square.ratio, wide: POST_SHAPES.wide.ratio };
  const box = (r: number) => ({ width: FRAME, height: FRAME / r });
  /** A framing the frame has measured: the whole source, in both units. */
  const measured = (source: { width: number; height: number }, over: Partial<Crop> = {}): Crop => ({
    ...CENTERED,
    area: { x: 0, y: 0, width: source.width, height: source.height },
    areaPercent: { x: 0, y: 0, width: 100, height: 100 },
    ...over,
  });
  /** The picture's drawn width: the library's 1× fit, times the zoom. */
  const drawn = (source: { width: number; height: number }, r: number, zoom: number) =>
    fittedPicture(source, box(r)).width * zoom;
  const LANDSCAPE = { width: 4000, height: 3000 };
  const PORTRAIT = { width: 3000, height: 4000 };

  it("lays the picture as the library does: fitted whole, never past its own pixels", () => {
    const landscape = fittedPicture(LANDSCAPE, box(ratio.tall));
    expect(landscape.width).toBe(412);
    expect(landscape.height).toBeCloseTo(309, 6);
    expect(fittedPicture(PORTRAIT, box(ratio.tall))).toEqual({ width: 386.25, height: 515 });
    expect(fittedPicture(PORTRAIT, box(ratio.square))).toEqual({ width: 309, height: 412 });
    expect(fittedPicture({ width: 200, height: 100 }, box(ratio.tall))).toEqual({ width: 200, height: 100 });
  });

  // What a shape change did before: the zoom stood, the box changed, and so
  // the picture's drawn size changed with it.
  it("names the shrink a kept zoom draws", () => {
    expect(drawn(PORTRAIT, ratio.tall, 1)).toBeCloseTo(386.25, 2);
    expect(drawn(PORTRAIT, ratio.square, 1)).toBeCloseTo(309, 2);
    expect(drawn(PORTRAIT, ratio.wide, 1)).toBeCloseTo(161.78, 2);
    expect(drawn(LANDSCAPE, ratio.wide, 1)).toBeCloseTo(287.61, 2);
  });

  it("keeps the picture at the size it stood at, tall to square to wide", () => {
    const tall = measured(PORTRAIT);
    const square = reshape(tall, ratio.tall, ratio.square, FRAME);
    expect(square.zoom).toBeCloseTo(1.25, 6);
    expect(drawn(PORTRAIT, ratio.square, square.zoom)).toBeCloseTo(386.25, 6);
    const wide = reshape(measured(PORTRAIT, { zoom: square.zoom }), ratio.square, ratio.wide, FRAME);
    expect(wide.zoom).toBeCloseTo(2.3875, 4);
    expect(drawn(PORTRAIT, ratio.wide, wide.zoom)).toBeCloseTo(386.25, 6);
  });

  it("keeps where the picture stands, centred on the same point", () => {
    const next = reshape(measured(LANDSCAPE, { zoom: 2, x: 100, y: 50 }), ratio.tall, ratio.wide, FRAME);
    expect(next.zoom).toBeCloseTo(2.865, 3);
    expect(next.x).toBe(100);
    expect(next.y).toBe(50);
  });

  it("raises the zoom only as far as the fill asks", () => {
    // Wide at 1× draws the landscape 287.61 wide; tall's fill is 412.
    const next = reshape(measured(LANDSCAPE), ratio.wide, ratio.tall, FRAME);
    expect(next.zoom).toBe(MIN_ZOOM);
    expect(drawn(LANDSCAPE, ratio.tall, next.zoom)).toBe(412);
  });

  it("holds the zoom at about 4×, never past it", () => {
    const next = reshape(measured(LANDSCAPE, { zoom: MAX_ZOOM }), ratio.tall, ratio.wide, FRAME);
    expect(next.zoom).toBe(MAX_ZOOM);
  });

  it("moves the picture only as far as its edge meeting the cut's asks", () => {
    // Tall, 2×: the landscape draws 824×618 and its cut is 247.2×309, so x
    // may reach 288.4. Wide at the same drawn size: the cut is 287.61×150.58,
    // so x may reach only 268.20 and y 233.71.
    const next = reshape(measured(LANDSCAPE, { zoom: 2, x: 288, y: 150 }), ratio.tall, ratio.wide, FRAME);
    const cut = cutOf(fittedPicture(LANDSCAPE, box(ratio.wide)), box(ratio.wide), ratio.wide);
    expect(cut.width).toBeCloseTo(287.61, 2);
    expect(next.x).toBeCloseTo(268.2, 2);
    expect(next.y).toBe(150);
  });

  it("drops the old shape's measured rectangle, always", () => {
    const next = reshape(measured(LANDSCAPE), ratio.tall, ratio.square, FRAME);
    expect(next.area).toBeNull();
    expect(next.areaPercent).toBeNull();
  });

  it("keeps the framing as it was where nothing has been measured", () => {
    const given = { ...CENTERED, zoom: 1.5, x: 3, y: -4 };
    expect(reshape(given, ratio.tall, ratio.wide, FRAME)).toEqual(given);
    expect(reshape(measured(LANDSCAPE, { zoom: 1.5 }), ratio.tall, ratio.wide, null).zoom).toBe(1.5);
  });

  it("reads the source's extent back off the measured rectangle", () => {
    expect(
      sourceOf({
        ...CENTERED,
        area: { x: 0, y: 400, width: 3000, height: 3750 },
        areaPercent: { x: 0, y: 10, width: 100, height: 93.75 },
      }),
    ).toEqual({ width: 3000, height: 4000 });
    expect(sourceOf(CENTERED)).toBeNull();
  });
});
