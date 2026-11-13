import { describe, expect, it } from "vitest";

import { POST_SHAPES } from "./aspect";
import {
  CENTERED,
  CROP_STAGE,
  fillOf,
  fittedPicture,
  frameOf,
  holdOffset,
  holdZoom,
  MAX_ZOOM,
  reshape,
  sourceOf,
  stageOf,
  usableArea,
  zoomBounds,
  type Crop,
} from "./crop";

const ratio = { tall: POST_SHAPES.tall.ratio, square: POST_SHAPES.square.ratio, wide: POST_SHAPES.wide.ratio };

describe("the crop the wizard carries", () => {
  it("starts centred, at the whole picture, and unmeasured", () => {
    // Unmeasured in BOTH units: the pixels the encoder bakes and the
    // percentages a downstream preview draws from arrive together or not at all.
    expect(CENTERED).toEqual({ x: 0, y: 0, zoom: 1, area: null, areaPercent: null });
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

// THE BOARDS' NUMBERS, recomputed at their 390 artboard (ComposeCrop.md:7-13,
// CoverCrop.md:11, AvatarCrop.md:7; seam 311 as corrected by 319).
describe("every stage and frame at the board's 390", () => {
  const W = 390;

  it("keeps one stage per crop, whatever the shape", () => {
    expect(CROP_STAGE.post).toEqual({ width: 390, height: 488 });
    expect(CROP_STAGE.cover).toEqual({ width: 390, height: 488 });
    expect(CROP_STAGE.avatar).toEqual({ width: 390, height: 390 });
    expect(stageOf("post", W)).toEqual({ width: 390, height: 488 });
  });

  it("stands the post's frames full width and centred: Tall fills, Square at 49, Wide at 142", () => {
    // 4:5 at 390 is 487.5: the board rounds to the stage's 488; the cut keeps
    // the exact ratio, a quarter pixel above and below.
    const tall = frameOf("post", ratio.tall, W);
    expect(tall).toEqual({ width: 390, height: 487.5, left: 0, top: 0.25 });
    expect(frameOf("post", ratio.square, W)).toEqual({ width: 390, height: 390, left: 0, top: 49 });
    const wide = frameOf("post", ratio.wide, W);
    expect(wide.width).toBe(390);
    expect(wide.height).toBeCloseTo(204.19, 2);
    expect(Math.round(wide.height)).toBe(204);
    expect(Math.round(wide.top)).toBe(142);
    expect(wide.left).toBe(0);
  });

  it("stands the cover's frame 342 wide between the gutters at the clip's shape", () => {
    const wide = frameOf("cover", 16 / 9, W);
    expect(wide.width).toBe(342);
    expect(wide.height).toBeCloseTo(192.375, 6);
    expect(Math.round(wide.top)).toBe(148);
    expect(wide.left).toBe(24);
    expect(frameOf("cover", 4 / 5, W)).toEqual({ width: 342, height: 427.5, left: 24, top: 30.25 });
    expect(frameOf("cover", 1, W)).toEqual({ width: 342, height: 342, left: 24, top: 73 });
  });

  it("stands the circle 342 at 24 in the square stage", () => {
    expect(stageOf("avatar", W)).toEqual({ width: 390, height: 390 });
    expect(frameOf("avatar", 1, W)).toEqual({ width: 342, height: 342, left: 24, top: 24 });
  });

  it("keeps the proportions on a wider column (the harness's 412)", () => {
    expect(stageOf("post", 412).height).toBeCloseTo(515.49, 2);
    expect(frameOf("post", ratio.square, 412)).toMatchObject({ width: 412, height: 412 });
    expect(frameOf("cover", 1, 412)).toMatchObject({ width: 364, height: 364, left: 24 });
  });

  it("never lets a frame stand taller than its stage", () => {
    const frame = frameOf("cover", 9 / 16, W);
    expect(frame.height).toBeCloseTo(488, 6);
    expect(frame.width / frame.height).toBeCloseTo(9 / 16, 9);
    expect(frame.top).toBeCloseTo(0, 6);
  });
});

describe("the zoom's floor and ceiling", () => {
  const W = 390;
  const stage = stageOf("post", W);
  const LANDSCAPE = fittedPicture({ width: 4000, height: 3000 }, stage);
  const PORTRAIT = fittedPicture({ width: 3000, height: 4000 }, stage);

  it("lays the picture as the library does: fitted whole into the stage, never past its own pixels", () => {
    expect(LANDSCAPE).toEqual({ width: 390, height: 292.5 });
    expect(PORTRAIT).toEqual({ width: 366, height: 488 });
    expect(fittedPicture({ width: 200, height: 100 }, stage)).toEqual({ width: 200, height: 100 });
  });

  it("floors the zoom at the frame's fill — the picture just covers the frame", () => {
    // A landscape in Tall: 292.5 tall must cover 487.5.
    expect(fillOf(LANDSCAPE, frameOf("post", ratio.tall, W))).toBeCloseTo(487.5 / 292.5, 9);
    expect(zoomBounds("post", LANDSCAPE, ratio.wide, W).floor).toBe(1);
    expect(zoomBounds("post", PORTRAIT, ratio.square, W).floor).toBeCloseTo(390 / 366, 9);
  });

  it("puts a post's ceiling at about 4× of its tallest frame, under every shape", () => {
    const tall = zoomBounds("post", LANDSCAPE, ratio.tall, W);
    expect(tall.ceiling).toBeCloseTo(4 * tall.floor, 9);
    for (const shape of [ratio.square, ratio.wide]) {
      expect(zoomBounds("post", LANDSCAPE, shape, W).ceiling).toBeCloseTo(tall.ceiling, 9);
    }
  });

  it("puts a cover's and the circle's ceiling at 4× their own fill", () => {
    const cover = zoomBounds("cover", LANDSCAPE, 16 / 9, W);
    expect(cover.ceiling).toBeCloseTo(MAX_ZOOM * cover.floor, 9);
    const avatar = zoomBounds("avatar", fittedPicture({ width: 4000, height: 3000 }, stageOf("avatar", W)), 1, W);
    expect(avatar.floor).toBeCloseTo(342 / 292.5, 9);
    expect(avatar.ceiling).toBeCloseTo(4 * avatar.floor, 9);
  });

  it("holds a zoom inside the bounds, and a non-number at the floor", () => {
    const bounds = { floor: 1.5, ceiling: 6 };
    expect(holdZoom(1, bounds)).toBe(1.5);
    expect(holdZoom(9, bounds)).toBe(6);
    expect(holdZoom(2, bounds)).toBe(2);
    expect(holdZoom(Number.NaN, bounds)).toBe(1.5);
  });

  it("covers a tiny picture by zooming it up, and a huge one by fitting it first", () => {
    const tiny = fittedPicture({ width: 40, height: 30 }, stage);
    expect(tiny).toEqual({ width: 40, height: 30 });
    expect(zoomBounds("post", tiny, ratio.tall, W).floor).toBeCloseTo(487.5 / 30, 9);
    const huge = fittedPicture({ width: 30000, height: 2000 }, stage);
    expect(huge.width).toBe(390);
    expect(zoomBounds("post", huge, ratio.wide, W).floor).toBeCloseTo(204.18848 / 26, 3);
  });

  it("stops the picture where its edge meets the frame's", () => {
    const frame = frameOf("post", ratio.wide, W);
    // At 2× the landscape lays 780 × 585: x may reach 195, y (585 − 204.19) / 2.
    const held = holdOffset({ x: 400, y: -400 }, LANDSCAPE, frame, 2);
    expect(held.x).toBe(195);
    expect(held.y).toBeCloseTo(-(585 - frame.height) / 2, 9);
    expect(holdOffset({ x: 10, y: 5 }, LANDSCAPE, frame, 2)).toEqual({ x: 10, y: 5 });
  });
});

// THE FRAME CHANGES AROUND THE PICTURE (ComposeCrop.md:19-23). The numbers are
// the board's 390 stage and the two pictures a camera hands over.
describe("reshape", () => {
  const W = 390;
  /** A framing the frame has measured: the whole source, in both units. */
  const measured = (source: { width: number; height: number }, over: Partial<Crop> = {}): Crop => ({
    ...CENTERED,
    area: { x: 0, y: 0, width: source.width, height: source.height },
    areaPercent: { x: 0, y: 0, width: 100, height: 100 },
    ...over,
  });
  const LANDSCAPE = { width: 4000, height: 3000 };
  const PORTRAIT = { width: 3000, height: 4000 };

  it("keeps the scale and the position, tall to square to wide", () => {
    const tall = measured(PORTRAIT, { zoom: 1.5, x: 20, y: -30 });
    const square = reshape(tall, ratio.square, W);
    expect(square).toMatchObject({ zoom: 1.5, x: 20, y: -30 });
    const wide = reshape({ ...square, area: tall.area, areaPercent: tall.areaPercent }, ratio.wide, W);
    expect(wide).toMatchObject({ zoom: 1.5, x: 20, y: -30 });
  });

  it("raises the scale to the new frame's fill, and no further", () => {
    // Wide's fill for the landscape is 1 (390 across); Tall's is 487.5 / 292.5.
    const next = reshape(measured(LANDSCAPE, { zoom: 1 }), ratio.tall, W);
    expect(next.zoom).toBeCloseTo(487.5 / 292.5, 9);
  });

  it("never shrinks the picture to fit the new frame", () => {
    const next = reshape(measured(LANDSCAPE, { zoom: 6 }), ratio.wide, W);
    expect(next.zoom).toBe(6);
    const back = reshape(measured(LANDSCAPE, { zoom: 6 }), ratio.tall, W);
    expect(back.zoom).toBe(6);
  });

  it("shifts the picture just enough that its edge meets the new frame's", () => {
    // Wide, 1×: the landscape lays 390 × 292.5 and the frame is 390 × 204.19,
    // so y may reach 44.15. Square at the same scale: the fill rises to 390 /
    // 292.5 and y comes to (390 − 390) / 2 = 0.
    const start = measured(LANDSCAPE, { zoom: 1, x: 0, y: 44 });
    expect(reshape(start, ratio.wide, W).y).toBe(44);
    const square = reshape(start, ratio.square, W);
    expect(square.zoom).toBeCloseTo(390 / 292.5, 9);
    expect(square.y).toBeCloseTo(0, 9);
  });

  it("drops the old shape's measured rectangle, always", () => {
    const next = reshape(measured(LANDSCAPE), ratio.square, W);
    expect(next.area).toBeNull();
    expect(next.areaPercent).toBeNull();
  });

  it("keeps the framing as it was where nothing has been measured", () => {
    const given = { ...CENTERED, zoom: 1.5, x: 3, y: -4 };
    expect(reshape(given, ratio.wide, W)).toEqual(given);
    expect(reshape(measured(LANDSCAPE, { zoom: 1.5 }), ratio.wide, null).zoom).toBe(1.5);
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
