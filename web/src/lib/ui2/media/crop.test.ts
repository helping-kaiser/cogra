// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  CENTERED,
  canPan,
  clampCrop,
  cropStyle,
  dragBy,
  MAX_ZOOM,
  MIN_ZOOM,
  NUDGE_STEP,
  panRange,
  visibleFraction,
  ZOOM_STEP,
  nudge,
  zoomBy,
} from "./crop";

/** A 3:2 photograph, the shape a phone camera hands back. */
const WIDE_SOURCE = 3 / 2;
/** A 2:3 photograph, the same camera turned. */
const TALL_SOURCE = 2 / 3;

const TALL_FRAME = 4 / 5;
const SQUARE_FRAME = 1;
const WIDE_FRAME = 1.91;

describe("clampCrop", () => {
  it("holds the zoom inside its range", () => {
    expect(clampCrop({ zoom: 0.2, x: 0.5, y: 0.5 }).zoom).toBe(MIN_ZOOM);
    expect(clampCrop({ zoom: 99, x: 0.5, y: 0.5 }).zoom).toBe(MAX_ZOOM);
  });

  it("holds the focal point inside the picture", () => {
    const crop = clampCrop({ zoom: 2, x: -3, y: 4 });
    expect(crop.x).toBe(0);
    expect(crop.y).toBe(1);
  });

  it("keeps the focal point at zoom 1, where it still chooses the band shown", () => {
    expect(clampCrop({ zoom: 1, x: 0.1, y: 0.9 })).toEqual({ zoom: 1, x: 0.1, y: 0.9 });
  });

  it("survives a non-finite value rather than propagating NaN into a transform", () => {
    const crop = clampCrop({ zoom: Number.NaN, x: Number.NaN, y: Number.NaN });
    expect(Number.isFinite(crop.zoom)).toBe(true);
    expect(Number.isFinite(crop.x)).toBe(true);
    expect(Number.isFinite(crop.y)).toBe(true);
  });
});

describe("visibleFraction", () => {
  it("shows a matching shape whole at zoom 1", () => {
    expect(visibleFraction(SQUARE_FRAME, SQUARE_FRAME, 1)).toEqual({ x: 1, y: 1 });
  });

  it("trims the width of a source wider than the frame", () => {
    const visible = visibleFraction(WIDE_SOURCE, TALL_FRAME, 1);
    expect(visible.x).toBeCloseTo(TALL_FRAME / WIDE_SOURCE);
    expect(visible.y).toBe(1);
  });

  it("trims the height of a source taller than the frame", () => {
    const visible = visibleFraction(TALL_SOURCE, WIDE_FRAME, 1);
    expect(visible.x).toBe(1);
    expect(visible.y).toBeCloseTo(TALL_SOURCE / WIDE_FRAME);
  });

  it("shrinks both axes as the zoom climbs", () => {
    const visible = visibleFraction(SQUARE_FRAME, SQUARE_FRAME, 2);
    expect(visible.x).toBeCloseTo(0.5);
    expect(visible.y).toBeCloseTo(0.5);
  });
});

describe("panRange", () => {
  // The bug this model exists to fix: a tall photograph in a wide frame had no
  // reachable framing but the middle band, because the travel was the zoom's
  // slack alone and at zoom 1 there is none.
  it("gives a tall picture vertical travel in a wide frame at zoom 1", () => {
    expect(panRange(TALL_SOURCE, WIDE_FRAME, 1).y).toBeGreaterThan(0);
  });

  it("gives a wide picture horizontal travel in a tall frame at zoom 1", () => {
    expect(panRange(WIDE_SOURCE, TALL_FRAME, 1).x).toBeGreaterThan(0);
  });

  it("is zero on both axes only when the shapes match at rest", () => {
    expect(panRange(SQUARE_FRAME, SQUARE_FRAME, 1)).toEqual({ x: 0, y: 0 });
    expect(panRange(SQUARE_FRAME, SQUARE_FRAME, 1.5).x).toBeGreaterThan(0);
  });
});

describe("zoomBy", () => {
  it("steps up and down and stops at the ends", () => {
    expect(zoomBy(CENTERED, ZOOM_STEP).zoom).toBeCloseTo(1 + ZOOM_STEP);
    expect(zoomBy(CENTERED, -ZOOM_STEP).zoom).toBe(MIN_ZOOM);
    expect(zoomBy({ zoom: MAX_ZOOM, x: 0.5, y: 0.5 }, ZOOM_STEP).zoom).toBe(MAX_ZOOM);
  });

  it("holds the focal point, so zooming does not re-centre the framing", () => {
    const framed = { zoom: 1, x: 0.2, y: 0.8 };
    expect(zoomBy(framed, ZOOM_STEP)).toMatchObject({ x: 0.2, y: 0.8 });
  });
});

describe("nudge", () => {
  it("moves the focal point by the step", () => {
    const crop = nudge({ zoom: 2, x: 0.5, y: 0.5 }, NUDGE_STEP, -NUDGE_STEP);
    expect(crop.x).toBeCloseTo(0.5 + NUDGE_STEP);
    expect(crop.y).toBeCloseTo(0.5 - NUDGE_STEP);
  });

  it("stops at the edge instead of running off the picture", () => {
    const crop = nudge({ zoom: 2, x: 0.98, y: 0.02 }, NUDGE_STEP, -NUDGE_STEP);
    expect(crop.x).toBe(1);
    expect(crop.y).toBe(0);
  });
});

describe("dragBy", () => {
  it("moves the focal point opposite the drag, so the picture follows the finger", () => {
    const crop = dragBy({ zoom: 2, x: 0.5, y: 0.5 }, 100, 0, 400, 400, SQUARE_FRAME, SQUARE_FRAME);
    expect(crop.x).toBeLessThan(0.5);
    // Shapes match, so the travel is the zoom's slack alone: with the window at
    // half the source, 100px over a 400px frame is a quarter of the range.
    expect(crop.x).toBeCloseTo(0.25);
  });

  it("scales the movement by the travel available", () => {
    const gentle = dragBy({ zoom: 3, x: 0.5, y: 0.5 }, 100, 0, 400, 400, SQUARE_FRAME, SQUARE_FRAME);
    const sharp = dragBy({ zoom: 1.5, x: 0.5, y: 0.5 }, 100, 0, 400, 400, SQUARE_FRAME, SQUARE_FRAME);
    expect(0.5 - gentle.x).toBeLessThan(0.5 - sharp.x);
  });

  // The regression the fix-round-2 ruling names: framing an off-shape picture
  // must not require zooming in first.
  it("pans a tall picture vertically in a wide frame at zoom 1", () => {
    const crop = dragBy(CENTERED, 0, 60, 400, 210, TALL_SOURCE, WIDE_FRAME);
    expect(crop.y).toBeLessThan(0.5);
  });

  it("does nothing on an axis the frame already shows whole", () => {
    const crop = dragBy(CENTERED, 200, 0, 400, 210, TALL_SOURCE, WIDE_FRAME);
    expect(crop.x).toBe(0.5);
  });

  it("does nothing at all when the picture is shown whole", () => {
    expect(dragBy(CENTERED, 200, 200, 400, 400, SQUARE_FRAME, SQUARE_FRAME)).toEqual(CENTERED);
  });

  it("does nothing when the frame has not been measured", () => {
    const start = { zoom: 2, x: 0.5, y: 0.5 };
    expect(dragBy(start, 50, 50, 0, 0, SQUARE_FRAME, SQUARE_FRAME)).toEqual(start);
  });
});

describe("cropStyle", () => {
  it("renders the model as a cover at the focal point, scaled about the same point", () => {
    expect(cropStyle({ zoom: 1.5, x: 0.25, y: 0.75 })).toEqual({
      transform: "scale(1.5)",
      transformOrigin: "25% 75%",
      objectFit: "cover",
      objectPosition: "25% 75%",
    });
  });

  it("clamps before rendering, so an out-of-range model cannot uncover the frame", () => {
    expect(cropStyle({ zoom: 9, x: 5, y: -5 })).toEqual({
      transform: `scale(${MAX_ZOOM})`,
      transformOrigin: "100% 0%",
      objectFit: "cover",
      objectPosition: "100% 0%",
    });
  });
});

describe("canPan", () => {
  it("is true at rest whenever the shapes differ", () => {
    expect(canPan(CENTERED, TALL_SOURCE, WIDE_FRAME)).toBe(true);
    expect(canPan(CENTERED, WIDE_SOURCE, TALL_FRAME)).toBe(true);
  });

  it("is false only where there is nothing left over to pan across", () => {
    expect(canPan(CENTERED, SQUARE_FRAME, SQUARE_FRAME)).toBe(false);
    expect(canPan({ zoom: 1.2, x: 0.5, y: 0.5 }, SQUARE_FRAME, SQUARE_FRAME)).toBe(true);
  });
});
